import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@simulyn/shared';
import { randomInt } from 'node:crypto';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { ProblemsService } from '../problems/problems.service';
import { examDeadline, SubmissionsService } from '../submissions/submissions.service';
import { CreateExamDto, SubmitExamDto, UpdateExamDto } from './dto/exam.dto';

export type ExamStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED';

const EXAM_SELECT = {
  id: true,
  classId: true,
  title: true,
  description: true,
  durationMin: true,
  scheduledStart: true,
  scheduledEnd: true,
  gracePeriodMin: true,
  randomizeOrder: true,
  isPublished: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  class: { select: { id: true, name: true, code: true, teacherId: true } },
  _count: { select: { problems: true, attempts: true } },
} satisfies Prisma.ExamSelect;

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function statusOf(exam: {
  isPublished: boolean;
  scheduledStart: Date;
  scheduledEnd: Date;
}): ExamStatus {
  if (!exam.isPublished) return 'DRAFT';
  const now = Date.now();
  if (now < exam.scheduledStart.getTime()) return 'SCHEDULED';
  if (now > exam.scheduledEnd.getTime()) return 'COMPLETED';
  return 'ACTIVE';
}

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly problems: ProblemsService,
    private readonly submissions: SubmissionsService,
  ) {}

  // ── access ─────────────────────────────────────────────────────────

  private async loadExam(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: { class: true },
    });
    if (!exam) throw new NotFoundException(`Exam ${id} not found`);
    return exam;
  }

  private assertManages(
    exam: { createdById: string; class: { teacherId: string } },
    requester: AuthenticatedUser,
  ): void {
    if (requester.role === Role.ADMIN) return;
    if (exam.class.teacherId === requester.id || exam.createdById === requester.id) return;
    throw new ForbiddenException('You do not own this exam');
  }

  private async assertEnrolled(classId: string, userId: string): Promise<void> {
    const enrolled = await this.prisma.enrollment.count({ where: { classId, userId } });
    if (enrolled === 0) throw new ForbiddenException('You are not enrolled in this class');
  }

  // ── CRUD ───────────────────────────────────────────────────────────

  async create(dto: CreateExamDto, requester: AuthenticatedUser) {
    const cls = await this.prisma.class.findUnique({ where: { id: dto.classId } });
    if (!cls) throw new NotFoundException(`Class ${dto.classId} not found`);
    if (requester.role !== Role.ADMIN && cls.teacherId !== requester.id) {
      throw new ForbiddenException('You do not teach this class');
    }

    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('scheduledEnd must be after scheduledStart');
    }

    const problemIds = dto.problems.map((p) => p.problemId);
    if (new Set(problemIds).size !== problemIds.length) {
      throw new BadRequestException('The same problem cannot be added twice');
    }

    const found = await this.prisma.problem.findMany({
      where: { id: { in: problemIds } },
      select: { id: true },
    });
    if (found.length !== problemIds.length) {
      const missing = problemIds.filter((id) => !found.some((f) => f.id === id));
      throw new BadRequestException(`Unknown problem ids: ${missing.join(', ')}`);
    }

    const exam = await this.prisma.exam.create({
      data: {
        classId: dto.classId,
        title: dto.title,
        description: dto.description,
        durationMin: dto.durationMin,
        scheduledStart: start,
        scheduledEnd: end,
        gracePeriodMin: dto.gracePeriodMin ?? 5,
        randomizeOrder: dto.randomizeOrder ?? true,
        isPublished: dto.isPublished ?? false,
        createdById: requester.id,
        problems: {
          create: dto.problems.map((p, i) => ({
            problemId: p.problemId,
            order: i,
            points: p.points ?? null,
          })),
        },
      },
      select: EXAM_SELECT,
    });

    this.logger.log(`${requester.username} created exam "${exam.title}"`);
    return { ...exam, status: statusOf(exam) };
  }

  async findAll(requester: AuthenticatedUser) {
    const where: Prisma.ExamWhereInput = {};

    if (requester.role === Role.STUDENT) {
      where.isPublished = true;
      where.class = { enrollments: { some: { userId: requester.id } } };
    } else if (requester.role === Role.TEACHER) {
      where.OR = [{ class: { teacherId: requester.id } }, { createdById: requester.id }];
    }

    const exams = await this.prisma.exam.findMany({
      where,
      select: EXAM_SELECT,
      orderBy: { scheduledStart: 'desc' },
    });

    // A student's own attempt is the piece the exam list needs.
    const attempts =
      requester.role === Role.STUDENT
        ? await this.prisma.examAttempt.findMany({
            where: { userId: requester.id, examId: { in: exams.map((e) => e.id) } },
          })
        : [];
    const byExam = new Map(attempts.map((a) => [a.examId, a]));

    return exams.map((exam) => {
      const attempt = byExam.get(exam.id);
      return {
        ...exam,
        status: statusOf(exam),
        attempt: attempt
          ? {
              id: attempt.id,
              startedAt: attempt.startedAt,
              submittedAt: attempt.submittedAt,
              autoSubmitted: attempt.autoSubmitted,
              totalScore: attempt.totalScore,
              integrityScore: attempt.integrityScore,
              endsAt: examDeadline(attempt.startedAt, exam),
            }
          : null,
      };
    });
  }

  /**
   * Metadata is visible to any enrolled student so the dashboard can count down
   * to the start. The problems themselves only appear once an attempt is open.
   */
  async findOne(id: string, requester: AuthenticatedUser) {
    const exam = await this.loadExam(id);
    const isStudent = requester.role === Role.STUDENT;

    if (isStudent) {
      if (!exam.isPublished) throw new NotFoundException(`Exam ${id} not found`);
      await this.assertEnrolled(exam.classId, requester.id);
    } else {
      this.assertManages(exam, requester);
    }

    const base = await this.prisma.exam.findUniqueOrThrow({ where: { id }, select: EXAM_SELECT });
    const attempt = isStudent
      ? await this.prisma.examAttempt.findUnique({
          where: { examId_userId: { examId: id, userId: requester.id } },
        })
      : null;

    const problems = await this.prisma.examProblem.findMany({
      where: { examId: id },
      include: {
        problem: {
          include: { testCases: { orderBy: { order: 'asc' } }, hints: { orderBy: { level: 'asc' } } },
        },
      },
      orderBy: { order: 'asc' },
    });

    const canSeeProblems = !isStudent || (attempt !== null && attempt.submittedAt === null);

    return {
      ...base,
      status: statusOf(base),
      attempt: attempt
        ? {
            id: attempt.id,
            startedAt: attempt.startedAt,
            submittedAt: attempt.submittedAt,
            totalScore: attempt.totalScore,
            integrityScore: attempt.integrityScore,
            terminated: attempt.terminated,
            terminatedReason: attempt.terminatedReason,
            endsAt: examDeadline(attempt.startedAt, base),
          }
        : null,
      problems: canSeeProblems
        ? this.orderProblems(problems, attempt?.questionOrder).map((ep) => ({
            id: ep.id,
            order: ep.order,
            points: ep.points ?? ep.problem.points,
            problem: this.problems.serialize(ep.problem, isStudent),
          }))
        : null,
    };
  }

  async update(id: string, dto: UpdateExamDto, requester: AuthenticatedUser) {
    const exam = await this.loadExam(id);
    this.assertManages(exam, requester);

    const attempts = await this.prisma.examAttempt.count({ where: { examId: id } });
    if (attempts > 0 && dto.problems) {
      throw new BadRequestException(
        'Students have already started this exam — its problem set can no longer change',
      );
    }

    const start = dto.scheduledStart ? new Date(dto.scheduledStart) : exam.scheduledStart;
    const end = dto.scheduledEnd ? new Date(dto.scheduledEnd) : exam.scheduledEnd;
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('scheduledEnd must be after scheduledStart');
    }

    if (dto.problems) {
      await this.prisma.examProblem.deleteMany({ where: { examId: id } });
      await this.prisma.examProblem.createMany({
        data: dto.problems.map((p, i) => ({
          examId: id,
          problemId: p.problemId,
          order: i,
          points: p.points ?? null,
        })),
      });
    }

    const updated = await this.prisma.exam.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        durationMin: dto.durationMin,
        scheduledStart: dto.scheduledStart ? start : undefined,
        scheduledEnd: dto.scheduledEnd ? end : undefined,
        gracePeriodMin: dto.gracePeriodMin,
        randomizeOrder: dto.randomizeOrder,
        isPublished: dto.isPublished,
      },
      select: EXAM_SELECT,
    });

    return { ...updated, status: statusOf(updated) };
  }

  async remove(id: string, requester: AuthenticatedUser) {
    const exam = await this.loadExam(id);
    this.assertManages(exam, requester);

    const attempts = await this.prisma.examAttempt.count({ where: { examId: id } });
    if (attempts > 0) {
      throw new BadRequestException(
        `This exam has ${attempts} attempt(s) and cannot be deleted — unpublish it instead`,
      );
    }

    await this.prisma.exam.delete({ where: { id } });
    return { success: true };
  }

  // ── taking an exam ─────────────────────────────────────────────────

  async start(id: string, requester: AuthenticatedUser) {
    const exam = await this.loadExam(id);
    if (!exam.isPublished) throw new NotFoundException(`Exam ${id} not found`);
    await this.assertEnrolled(exam.classId, requester.id);

    const now = Date.now();
    if (now < exam.scheduledStart.getTime()) {
      throw new BadRequestException('This exam has not opened yet');
    }
    if (now > exam.scheduledEnd.getTime() + exam.gracePeriodMin * 60_000) {
      throw new BadRequestException('This exam has closed');
    }

    const existing = await this.prisma.examAttempt.findUnique({
      where: { examId_userId: { examId: id, userId: requester.id } },
    });
    // Checked before submittedAt: a removal also closes the attempt, and the
    // student needs the real reason rather than "already submitted".
    if (existing?.terminated) {
      throw new ForbiddenException(
        existing.terminatedReason
          ? `You were removed from this exam: ${existing.terminatedReason}`
          : 'You were removed from this exam',
      );
    }
    if (existing?.submittedAt) {
      throw new BadRequestException('You have already submitted this exam');
    }

    const examProblems = await this.prisma.examProblem.findMany({
      where: { examId: id },
      include: {
        problem: {
          include: { testCases: { orderBy: { order: 'asc' } }, hints: { orderBy: { level: 'asc' } } },
        },
      },
      orderBy: { order: 'asc' },
    });
    if (examProblems.length === 0) {
      throw new BadRequestException('This exam has no problems');
    }

    const attempt =
      existing ??
      (await this.prisma.examAttempt.create({
        data: {
          examId: id,
          userId: requester.id,
          questionOrder: JSON.stringify(
            exam.randomizeOrder
              ? shuffle(examProblems.map((p) => p.problemId))
              : examProblems.map((p) => p.problemId),
          ),
        },
      }));

    const endsAt = examDeadline(attempt.startedAt, exam);
    if (Date.now() > endsAt.getTime()) {
      throw new BadRequestException('Your time for this exam has already run out');
    }

    this.logger.log(`${requester.username} started exam "${exam.title}"`);

    return {
      attemptId: attempt.id,
      examId: exam.id,
      title: exam.title,
      startedAt: attempt.startedAt,
      endsAt,
      durationMin: exam.durationMin,
      integrityScore: attempt.integrityScore,
      questions: this.orderProblems(examProblems, attempt.questionOrder).map((ep, index) => ({
        index,
        examProblemId: ep.id,
        points: ep.points ?? ep.problem.points,
        problem: this.problems.serialize(ep.problem, true),
      })),
    };
  }

  async submit(id: string, dto: SubmitExamDto, requester: AuthenticatedUser) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { examId_userId: { examId: id, userId: requester.id } },
      include: { exam: true },
    });
    if (!attempt) throw new NotFoundException('You have not started this exam');
    if (attempt.terminated) {
      throw new ForbiddenException('You were removed from this exam');
    }
    if (attempt.submittedAt) {
      throw new BadRequestException('This exam has already been submitted');
    }

    const totalScore = await this.submissions.recalculateAttemptScore(attempt.id);
    const deadline = examDeadline(attempt.startedAt, attempt.exam);
    const autoSubmitted = dto.autoSubmitted === true || Date.now() > deadline.getTime();

    const updated = await this.prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { submittedAt: new Date(), autoSubmitted, totalScore },
    });

    this.logger.log(
      `${requester.username} submitted exam "${attempt.exam.title}" (${totalScore} points${autoSubmitted ? ', auto' : ''})`,
    );

    return {
      attemptId: updated.id,
      submittedAt: updated.submittedAt,
      autoSubmitted: updated.autoSubmitted,
      totalScore: updated.totalScore,
      integrityScore: updated.integrityScore,
    };
  }

  // ── results ────────────────────────────────────────────────────────

  async results(id: string, requester: AuthenticatedUser) {
    const exam = await this.loadExam(id);
    this.assertManages(exam, requester);

    await this.finaliseExpiredAttempts(id);

    const [attempts, enrolled, maxPoints] = await Promise.all([
      this.prisma.examAttempt.findMany({
        where: { examId: id },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatar: true } },
          _count: { select: { violations: true, submissions: true } },
        },
        orderBy: { totalScore: 'desc' },
      }),
      this.prisma.enrollment.findMany({
        where: { classId: exam.classId },
        include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
      }),
      this.examMaxPoints(id),
    ]);

    const started = new Set(attempts.map((a) => a.userId));

    const rows = attempts.map((a) => ({
      attemptId: a.id,
      user: a.user,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      autoSubmitted: a.autoSubmitted,
      totalScore: a.totalScore,
      maxScore: maxPoints,
      percentage: maxPoints === 0 ? 0 : Math.round((a.totalScore / maxPoints) * 100),
      integrityScore: a.integrityScore,
      flagged: a.flagged,
      terminated: a.terminated,
      terminatedReason: a.terminatedReason,
      terminatedBy: a.terminatedBy,
      violationCount: a._count.violations,
      submissionCount: a._count.submissions,
      timeTakenMin: a.submittedAt
        ? Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 60_000)
        : null,
      status: a.terminated ? 'REMOVED' : a.submittedAt ? 'SUBMITTED' : 'IN_PROGRESS',
    }));

    const notStarted = enrolled
      .filter((e) => !started.has(e.userId))
      .map((e) => ({ user: e.user, status: 'NOT_STARTED' as const }));

    const submitted = rows.filter((r) => r.submittedAt);

    return {
      exam: { id: exam.id, title: exam.title, status: statusOf(exam), maxScore: maxPoints },
      summary: {
        enrolled: enrolled.length,
        started: rows.length,
        submitted: submitted.length,
        notStarted: notStarted.length,
        averageScore:
          submitted.length === 0
            ? 0
            : Math.round(submitted.reduce((s, r) => s + r.totalScore, 0) / submitted.length),
        averageIntegrity:
          rows.length === 0
            ? 100
            : Math.round(rows.reduce((s, r) => s + r.integrityScore, 0) / rows.length),
      },
      attempts: rows,
      notStarted,
    };
  }

  async attemptDetail(examId: string, attemptId: string, requester: AuthenticatedUser) {
    const exam = await this.loadExam(examId);

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
        submissions: {
          include: { problem: { select: { title: true, points: true } }, _count: { select: { testResults: true } } },
          orderBy: { createdAt: 'asc' },
        },
        violations: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!attempt || attempt.examId !== examId) {
      throw new NotFoundException(`Attempt ${attemptId} not found for this exam`);
    }

    // Students may only read their own attempt.
    if (requester.role === Role.STUDENT) {
      if (attempt.userId !== requester.id) throw new ForbiddenException('That attempt is not yours');
    } else {
      this.assertManages(exam, requester);
    }

    return {
      attemptId: attempt.id,
      exam: { id: exam.id, title: exam.title, durationMin: exam.durationMin },
      user: attempt.user,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      autoSubmitted: attempt.autoSubmitted,
      endsAt: examDeadline(attempt.startedAt, exam),
      totalScore: attempt.totalScore,
      integrityScore: attempt.integrityScore,
      flagged: attempt.flagged,
      terminated: attempt.terminated,
      terminatedAt: attempt.terminatedAt,
      terminatedReason: attempt.terminatedReason,
      terminatedBy: attempt.terminatedBy,
      questionOrder: JSON.parse(attempt.questionOrder) as string[],
      submissions: attempt.submissions.map((s) => ({
        id: s.id,
        problemId: s.problemId,
        problemTitle: s.problem.title,
        language: s.language,
        passed: s.passed,
        score: s.score,
        maxScore: s.problem.points,
        attemptNumber: s.attemptNumber,
        createdAt: s.createdAt,
        // The code itself is only for staff reviewing an attempt.
        code: requester.role === Role.STUDENT ? undefined : s.code,
      })),
      violations: attempt.violations.map((v) => ({
        id: v.id,
        typeKey: v.typeKey,
        weight: v.weight,
        timeRemaining: v.timeRemaining,
        createdAt: v.createdAt,
        codeSnapshot: requester.role === Role.STUDENT ? undefined : v.codeSnapshot,
        metadata: v.metadata,
      })),
    };
  }

  // ── helpers ────────────────────────────────────────────────────────

  private orderProblems<T extends { problemId: string }>(items: T[], questionOrder?: string): T[] {
    if (!questionOrder) return items;
    let order: string[];
    try {
      order = JSON.parse(questionOrder) as string[];
    } catch {
      return items;
    }
    const rank = new Map(order.map((id, i) => [id, i]));
    return [...items].sort(
      (a, b) => (rank.get(a.problemId) ?? 999) - (rank.get(b.problemId) ?? 999),
    );
  }

  private async examMaxPoints(examId: string): Promise<number> {
    const problems = await this.prisma.examProblem.findMany({
      where: { examId },
      include: { problem: { select: { points: true } } },
    });
    return problems.reduce((sum, p) => sum + (p.points ?? p.problem.points), 0);
  }

  /** Closes attempts whose deadline passed without an explicit submit. */
  async finaliseExpiredAttempts(examId: string): Promise<number> {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return 0;

    const open = await this.prisma.examAttempt.findMany({
      where: { examId, submittedAt: null },
    });

    let closed = 0;
    for (const attempt of open) {
      const deadline = examDeadline(attempt.startedAt, exam);
      if (Date.now() <= deadline.getTime()) continue;

      const totalScore = await this.submissions.recalculateAttemptScore(attempt.id);
      await this.prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { submittedAt: deadline, autoSubmitted: true, totalScore },
      });
      closed += 1;
    }

    if (closed > 0) this.logger.log(`Auto-submitted ${closed} expired attempt(s) for exam ${examId}`);
    return closed;
  }
}
