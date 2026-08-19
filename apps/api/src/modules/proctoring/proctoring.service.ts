import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  FLAG_THRESHOLD,
  INITIAL_INTEGRITY_SCORE,
  Prisma,
  Role,
  VIOLATION_TYPES,
  ViolationType,
  type ViolationTypeKey,
} from '@simulyn/shared';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmissionsService } from '../submissions/submissions.service';
import { QueryViolationsDto, RecordViolationDto } from './dto/violation.dto';

export interface RecordedViolation {
  id: string;
  examAttemptId: string;
  examId: string;
  userId: string;
  username: string;
  displayName: string;
  typeKey: ViolationType;
  label: string;
  message: string;
  severity: string;
  critical: boolean;
  weight: number;
  timeRemaining: number | null;
  integrityScore: number;
  violationCount: number;
  /** True once the attempt has crossed FLAG_THRESHOLD violations. */
  flagged: boolean;
  /** Set on the one violation that tipped it over, so the UI can alert once. */
  justFlagged: boolean;
  /** True once the student has been removed from the exam. */
  terminated: boolean;
  createdAt: Date;
}

export interface TerminationResult {
  attemptId: string;
  examId: string;
  userId: string;
  username: string;
  displayName: string;
  reason: string;
  /** Username of the proctor, or null when the threshold did it. */
  by: string | null;
  violationCount: number;
  integrityScore: number;
  totalScore: number;
  at: Date;
}

export { FLAG_THRESHOLD };

@Injectable()
export class ProctoringService {
  private readonly logger = new Logger(ProctoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly submissions: SubmissionsService,
  ) {}

  /**
   * Records a violation and deducts its weight from the attempt's integrity
   * score, which is floored at zero.
   */
  async record(dto: RecordViolationDto, actor: AuthenticatedUser): Promise<RecordedViolation> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: dto.examAttemptId },
      include: {
        exam: { include: { class: { select: { teacherId: true } } } },
        user: { select: { id: true, username: true, displayName: true } },
      },
    });
    if (!attempt) throw new NotFoundException(`Exam attempt ${dto.examAttemptId} not found`);

    // Students may only report their own violations; staff may flag manually.
    if (actor.role === Role.STUDENT) {
      if (attempt.userId !== actor.id) {
        throw new ForbiddenException('That exam attempt belongs to another student');
      }
    } else if (actor.role === Role.TEACHER && attempt.exam.class.teacherId !== actor.id) {
      throw new ForbiddenException('You do not proctor this exam');
    }

    // Staff may still annotate a finished attempt while reviewing it.
    if (attempt.submittedAt && actor.role === Role.STUDENT) {
      throw new BadRequestException('This attempt has already been submitted');
    }
    if (attempt.terminated && actor.role === Role.STUDENT) {
      throw new BadRequestException('You have been removed from this exam');
    }

    const definition = VIOLATION_TYPES[dto.typeKey as ViolationTypeKey];
    const weight = dto.weight ?? definition?.weight ?? 0;
    const integrityScore = Math.max(0, attempt.integrityScore - weight);

    const [violation, updated, count] = await this.prisma.$transaction([
      this.prisma.violation.create({
        data: {
          examAttemptId: dto.examAttemptId,
          userId: attempt.userId,
          typeKey: dto.typeKey,
          weight,
          codeSnapshot: dto.codeSnapshot,
          timeRemaining: dto.timeRemaining,
          metadata: dto.metadata,
        },
      }),
      this.prisma.examAttempt.update({
        where: { id: dto.examAttemptId },
        data: { integrityScore },
      }),
      this.prisma.violation.count({ where: { examAttemptId: dto.examAttemptId } }),
    ]);

    // Enough violations flags the attempt outright, independently of the
    // integrity score — a run of low-weight events still means something. Only
    // violations since the last readmit count, so a readmitted student is not
    // ejected again by their own history.
    const sinceReadmit = count - attempt.violationBaseline;
    const shouldFlag = sinceReadmit >= FLAG_THRESHOLD;
    const justFlagged = shouldFlag && !attempt.flagged;

    // Crossing the threshold removes the student from the exam. A proctor can
    // readmit them from the live board.
    if (justFlagged) {
      await this.terminateAttempt(
        attempt.id,
        `Automatically removed after ${sinceReadmit} violations`,
        null,
      );
      this.logger.warn(
        `${attempt.user.username} FLAGGED and removed after ${sinceReadmit} violations on attempt ${attempt.id}`,
      );
    }

    this.logger.warn(
      `${attempt.user.username}: ${dto.typeKey} (-${weight}) → integrity ${integrityScore}`,
    );

    return {
      id: violation.id,
      examAttemptId: attempt.id,
      examId: attempt.examId,
      userId: attempt.userId,
      username: attempt.user.username,
      displayName: attempt.user.displayName,
      typeKey: dto.typeKey,
      label: definition?.label ?? dto.typeKey,
      message: (definition?.teacherAlert ?? '{name} triggered a violation').replace(
        '{name}',
        attempt.user.displayName,
      ),
      severity: definition?.severity ?? 'medium',
      critical: definition?.critical ?? false,
      weight,
      timeRemaining: dto.timeRemaining ?? null,
      integrityScore: updated.integrityScore,
      violationCount: count,
      flagged: shouldFlag,
      justFlagged,
      terminated: attempt.terminated || justFlagged,
      createdAt: violation.createdAt,
    };
  }

  /**
   * Closes an attempt and marks it removed. The work done so far is scored and
   * kept — ejection is a discipline decision, not a reason to destroy evidence
   * — and `submittedAt` is set so nothing downstream sees a dangling attempt.
   *
   * `by` is the proctor's username, or null when the violation threshold fired.
   */
  private async terminateAttempt(
    attemptId: string,
    reason: string,
    by: string | null,
  ): Promise<number> {
    const totalScore = await this.submissions.recalculateAttemptScore(attemptId);

    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        flagged: true,
        terminated: true,
        terminatedAt: new Date(),
        terminatedReason: reason,
        terminatedBy: by,
        submittedAt: new Date(),
        autoSubmitted: true,
        totalScore,
      },
    });

    return totalScore;
  }

  /** Removes a student from an exam on a proctor's instruction. */
  async terminate(
    examAttemptId: string,
    reason: string,
    actor: AuthenticatedUser,
  ): Promise<TerminationResult> {
    const attempt = await this.loadProctoredAttempt(examAttemptId, actor);
    if (attempt.terminated) {
      throw new BadRequestException('This student has already been removed from the exam');
    }

    // Recorded on the same timeline as the detections, so the eject and its
    // stated reason are visible in the attempt's history.
    await this.record(
      {
        examAttemptId,
        typeKey: ViolationType.MANUAL,
        weight: 0,
        metadata: JSON.stringify({ note: `Removed from exam: ${reason}`, by: actor.username }),
      },
      actor,
    );

    const totalScore = await this.terminateAttempt(examAttemptId, reason, actor.username);
    const [violationCount, updated] = await Promise.all([
      this.prisma.violation.count({ where: { examAttemptId } }),
      this.prisma.examAttempt.findUniqueOrThrow({ where: { id: examAttemptId } }),
    ]);

    this.logger.warn(
      `${actor.username} removed ${attempt.user.username} from exam ${attempt.examId}: ${reason}`,
    );

    return {
      attemptId: attempt.id,
      examId: attempt.examId,
      userId: attempt.userId,
      username: attempt.user.username,
      displayName: attempt.user.displayName,
      reason,
      by: actor.username,
      violationCount,
      integrityScore: updated.integrityScore,
      totalScore,
      at: updated.terminatedAt ?? new Date(),
    };
  }

  /**
   * Lets a removed student back into the exam. Their violations stay on record,
   * but the flag threshold is re-based to the current count so they are not
   * ejected again the instant they reconnect.
   */
  async readmit(examAttemptId: string, actor: AuthenticatedUser) {
    const attempt = await this.loadProctoredAttempt(examAttemptId, actor);
    if (!attempt.terminated) {
      throw new BadRequestException('This student has not been removed from the exam');
    }

    const violationCount = await this.prisma.violation.count({ where: { examAttemptId } });

    const updated = await this.prisma.examAttempt.update({
      where: { id: examAttemptId },
      data: {
        flagged: false,
        terminated: false,
        terminatedAt: null,
        terminatedReason: null,
        terminatedBy: null,
        violationBaseline: violationCount,
        // Reopen the paper: the deadline still applies, so they get whatever is
        // left of their original window rather than a fresh one.
        submittedAt: null,
        autoSubmitted: false,
      },
    });

    await this.prisma.violation.create({
      data: {
        examAttemptId,
        userId: attempt.userId,
        typeKey: ViolationType.MANUAL,
        weight: 0,
        metadata: JSON.stringify({
          note: 'Readmitted to the exam',
          by: actor.username,
        }),
      },
    });

    this.logger.warn(
      `${actor.username} readmitted ${attempt.user.username} to exam ${attempt.examId}`,
    );

    return {
      attemptId: updated.id,
      examId: attempt.examId,
      userId: attempt.userId,
      username: attempt.user.username,
      displayName: attempt.user.displayName,
      by: actor.username,
      violationBaseline: updated.violationBaseline,
      integrityScore: updated.integrityScore,
      at: new Date(),
    };
  }

  /** Loads an attempt and asserts the actor is entitled to proctor it. */
  private async loadProctoredAttempt(examAttemptId: string, actor: AuthenticatedUser) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: examAttemptId },
      include: {
        exam: { include: { class: { select: { teacherId: true } } } },
        user: { select: { id: true, username: true, displayName: true } },
      },
    });
    if (!attempt) throw new NotFoundException(`Exam attempt ${examAttemptId} not found`);

    if (actor.role === Role.TEACHER && attempt.exam.class.teacherId !== actor.id) {
      throw new ForbiddenException('You do not proctor this exam');
    }
    if (actor.role === Role.STUDENT) {
      throw new ForbiddenException('Only a proctor can do that');
    }

    return attempt;
  }

  /**
   * A proctor's own observation about an attempt. Stored as a zero-weight
   * MANUAL violation so notes and detections share one timeline.
   */
  async flag(examAttemptId: string, note: string, actor: AuthenticatedUser) {
    return this.record(
      {
        examAttemptId,
        typeKey: ViolationType.MANUAL,
        weight: 0,
        metadata: JSON.stringify({ note, by: actor.username }),
      },
      actor,
    );
  }

  /** Proctor notes for an attempt, newest first. */
  async notes(examAttemptId: string, requester: AuthenticatedUser) {
    const rows = await this.list({ examAttemptId, typeKey: ViolationType.MANUAL }, requester);
    return rows.map((row) => {
      let note = '';
      let by = '';
      try {
        const parsed = JSON.parse(row.metadata ?? '{}') as { note?: string; by?: string };
        note = parsed.note ?? '';
        by = parsed.by ?? '';
      } catch {
        note = row.metadata ?? '';
      }
      return { id: row.id, note, by, createdAt: row.createdAt };
    });
  }

  async list(query: QueryViolationsDto, requester: AuthenticatedUser) {
    const where: Prisma.ViolationWhereInput = {};
    if (query.examAttemptId) where.examAttemptId = query.examAttemptId;
    if (query.userId) where.userId = query.userId;
    if (query.typeKey) where.typeKey = query.typeKey;
    if (query.examId) where.examAttempt = { examId: query.examId };

    // Students only ever see their own record; teachers only their own exams.
    if (requester.role === Role.STUDENT) {
      where.userId = requester.id;
    } else if (requester.role === Role.TEACHER) {
      where.examAttempt = {
        ...(query.examId ? { examId: query.examId } : {}),
        exam: { class: { teacherId: requester.id } },
      };
    }

    const violations = await this.prisma.violation.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
        examAttempt: { select: { id: true, examId: true, integrityScore: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return violations.map((v) => {
      const definition = VIOLATION_TYPES[v.typeKey as ViolationTypeKey];
      return {
        id: v.id,
        examAttemptId: v.examAttemptId,
        examId: v.examAttempt.examId,
        user: v.user,
        typeKey: v.typeKey,
        label: definition?.label ?? v.typeKey,
        severity: definition?.severity ?? 'medium',
        critical: definition?.critical ?? false,
        weight: v.weight,
        timeRemaining: v.timeRemaining,
        integrityScore: v.examAttempt.integrityScore,
        codeSnapshot: requester.role === Role.STUDENT ? undefined : v.codeSnapshot,
        metadata: v.metadata,
        createdAt: v.createdAt,
      };
    });
  }

  /** Live board for the proctor view: one row per student who has started. */
  async liveBoard(examId: string, requester: AuthenticatedUser) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { class: { select: { teacherId: true } } },
    });
    if (!exam) throw new NotFoundException(`Exam ${examId} not found`);
    if (requester.role === Role.TEACHER && exam.class.teacherId !== requester.id) {
      throw new ForbiddenException('You do not proctor this exam');
    }

    const attempts = await this.prisma.examAttempt.findMany({
      where: { examId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
        violations: { orderBy: { createdAt: 'desc' }, take: 5 },
        _count: { select: { violations: true, submissions: true } },
      },
    });

    return attempts.map((a) => ({
      attemptId: a.id,
      user: a.user,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      integrityScore: a.integrityScore,
      flagged: a.flagged,
      terminated: a.terminated,
      terminatedReason: a.terminatedReason,
      terminatedBy: a.terminatedBy,
      violationCount: a._count.violations,
      // What the flag threshold actually measures — see violationBaseline.
      violationsSinceReadmit: a._count.violations - a.violationBaseline,
      submissionCount: a._count.submissions,
      recentViolations: a.violations.map((v) => ({
        typeKey: v.typeKey,
        weight: v.weight,
        createdAt: v.createdAt,
      })),
    }));
  }

  get initialIntegrityScore(): number {
    return INITIAL_INTEGRITY_SCORE;
  }
}
