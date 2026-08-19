import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  languageKeyFromEnum,
  Prisma,
  Role,
  SubmissionStatus,
  type Language,
} from '@simulyn/shared';

import { orderByFrom, paginated, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { ExecutionService, HIDDEN_ERROR_NOTICE } from '../execution/execution.service';
import { GamificationService, type AwardResult } from '../gamification/gamification.service';
import { CreateSubmissionDto, QuerySubmissionsDto } from './dto/create-submission.dto';

const SORTABLE = ['createdAt', 'score', 'executionMs'] as const;

export interface SubmissionResponse {
  id: string;
  problemId: string;
  userId: string;
  examAttemptId: string | null;
  language: Language;
  status: SubmissionStatus;
  passed: boolean;
  score: number;
  maxScore: number;
  attemptNumber: number;
  compileError: string | null;
  executionMs: number | null;
  createdAt: Date;
  passedCount: number;
  totalCount: number;
  testResults: {
    input: string;
    expected: string;
    actual: string | null;
    stdout?: string | null;
    passed: boolean;
    stderr: string | null;
    exitCode: number | null;
    timedOut: boolean;
    executionMs: number | null;
    isHidden: boolean;
  }[];
  reward: AwardResult | null;
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly execution: ExecutionService,
    private readonly gamification: GamificationService,
  ) {}

  // ── create ─────────────────────────────────────────────────────────

  async create(dto: CreateSubmissionDto, requester: AuthenticatedUser): Promise<SubmissionResponse> {
    const problem = await this.prisma.problem.findUnique({ where: { id: dto.problemId } });
    if (!problem) throw new NotFoundException(`Problem ${dto.problemId} not found`);
    if (requester.role === Role.STUDENT && !problem.isPublished) {
      throw new NotFoundException(`Problem ${dto.problemId} not found`);
    }
    if (problem.type !== 'PROGRAMMING') {
      throw new BadRequestException('Electronics problems are graded via POST /electronics/submit');
    }

    if (dto.examAttemptId) {
      await this.assertExamSubmissionAllowed(dto.examAttemptId, dto.problemId, requester);
    }

    const attemptNumber =
      (await this.prisma.submission.count({
        where: { userId: requester.id, problemId: dto.problemId },
      })) + 1;

    // Whether XP has already been paid out for this problem.
    const alreadySolved =
      (await this.prisma.submission.count({
        where: { userId: requester.id, problemId: dto.problemId, passed: true },
      })) > 0;

    const submission = await this.prisma.submission.create({
      data: {
        userId: requester.id,
        problemId: dto.problemId,
        examAttemptId: dto.examAttemptId ?? null,
        code: dto.code,
        language: dto.language,
        status: SubmissionStatus.PENDING,
        attemptNumber,
      },
    });

    await this.prisma.submission.update({
      where: { id: submission.id },
      data: { status: SubmissionStatus.RUNNING },
    });

    const lang = languageKeyFromEnum(dto.language);

    let evaluation;
    try {
      evaluation = await this.execution.evaluateProblem(dto.problemId, dto.code, lang);
    } catch (error) {
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.ERROR,
          compileError: error instanceof Error ? error.message : 'Execution failed',
        },
      });
      throw error;
    }

    if (evaluation.results.length > 0) {
      await this.prisma.testResult.createMany({
        data: evaluation.results.map((r) => ({
          submissionId: submission.id,
          input: r.input,
          expected: r.expected,
          actual: r.actual,
          passed: r.passed,
          stderr: r.stderr,
          exitCode: r.exitCode,
          timedOut: r.timedOut,
          executionMs: r.executionMs,
        })),
      });
    }

    const score =
      evaluation.totalCount === 0
        ? 0
        : Math.round((evaluation.passedCount / evaluation.totalCount) * problem.points);

    const completed = await this.prisma.submission.update({
      where: { id: submission.id },
      data: {
        // A compile error is a legitimate graded outcome, not a server failure.
        status: SubmissionStatus.COMPLETED,
        passed: evaluation.allPassed,
        score,
        compileError: evaluation.compileError,
        executionMs: evaluation.totalMs,
      },
    });

    // XP is only paid for a first full solve outside of an exam.
    let reward: AwardResult | null = null;
    if (evaluation.allPassed && !dto.examAttemptId && !alreadySolved) {
      reward = await this.gamification.awardXP(requester.id, problem.points);
    } else if (evaluation.allPassed && !dto.examAttemptId) {
      // Still refresh the streak and solved count, without granting XP again.
      reward = await this.gamification.awardXP(requester.id, 0);
    }

    if (dto.examAttemptId) {
      await this.recalculateAttemptScore(dto.examAttemptId);
    }

    this.logger.log(
      `${requester.username} submitted ${problem.title} (${dto.language}) → ${evaluation.passedCount}/${evaluation.totalCount}`,
    );

    return this.toResponse(
      completed,
      problem.points,
      evaluation.results.map((r) => ({
        input: r.input,
        expected: r.expected,
        actual: r.actual,
        // Live only — debug output is not worth a column on TestResult.
        stdout: r.stdout,
        passed: r.passed,
        stderr: r.stderr,
        exitCode: r.exitCode,
        timedOut: r.timedOut,
        executionMs: r.executionMs,
        isHidden: r.isHidden,
      })),
      reward,
      requester.role === Role.STUDENT,
    );
  }

  /** Rejects exam submissions from the wrong student, after the deadline, or for an unrelated problem. */
  private async assertExamSubmissionAllowed(
    examAttemptId: string,
    problemId: string,
    requester: AuthenticatedUser,
  ): Promise<void> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: examAttemptId },
      include: { exam: { include: { problems: { select: { problemId: true } } } } },
    });
    if (!attempt) throw new NotFoundException(`Exam attempt ${examAttemptId} not found`);
    if (attempt.userId !== requester.id) {
      throw new ForbiddenException('That exam attempt belongs to another student');
    }
    if (attempt.submittedAt) {
      throw new BadRequestException('This exam has already been submitted');
    }
    if (!attempt.exam.problems.some((p) => p.problemId === problemId)) {
      throw new BadRequestException('That problem is not part of this exam');
    }

    const deadline = examDeadline(attempt.startedAt, attempt.exam);
    if (Date.now() > deadline.getTime()) {
      throw new BadRequestException('The exam time limit has passed — this attempt is closed');
    }
  }

  /** Best score per problem, summed. Called after every exam submission. */
  async recalculateAttemptScore(examAttemptId: string): Promise<number> {
    const submissions = await this.prisma.submission.findMany({
      where: { examAttemptId },
      select: { problemId: true, score: true },
    });

    const best = new Map<string, number>();
    for (const s of submissions) {
      best.set(s.problemId, Math.max(best.get(s.problemId) ?? 0, s.score));
    }
    const totalScore = [...best.values()].reduce((sum, v) => sum + v, 0);

    await this.prisma.examAttempt.update({
      where: { id: examAttemptId },
      data: { totalScore },
    });
    return totalScore;
  }

  // ── queries ────────────────────────────────────────────────────────

  async findAll(
    query: QuerySubmissionsDto,
    requester: AuthenticatedUser,
  ): Promise<PaginatedResult<unknown>> {
    let userId = requester.id;

    if (query.userId && query.userId !== requester.id) {
      if (requester.role === Role.STUDENT) {
        throw new ForbiddenException('You may only list your own submissions');
      }
      await this.assertCanSeeStudent(query.userId, requester);
      userId = query.userId;
    }

    const where: Prisma.SubmissionWhereInput = { userId };
    if (query.problemId) where.problemId = query.problemId;
    if (query.language) where.language = query.language;
    if (typeof query.passed === 'boolean') where.passed = query.passed;
    if (query.examAttemptId) where.examAttemptId = query.examAttemptId;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.submission.findMany({
        where,
        orderBy: orderByFrom(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.limit,
        select: {
          id: true,
          problemId: true,
          userId: true,
          examAttemptId: true,
          language: true,
          status: true,
          passed: true,
          score: true,
          attemptNumber: true,
          executionMs: true,
          compileError: true,
          createdAt: true,
          problem: { select: { title: true, difficulty: true, category: true, points: true } },
          _count: { select: { testResults: true } },
        },
      }),
      this.prisma.submission.count({ where }),
    ]);

    return paginated(rows, total, query);
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        testResults: true,
        problem: { select: { title: true, points: true, testCases: { select: { isHidden: true, order: true } } } },
      },
    });
    if (!submission) throw new NotFoundException(`Submission ${id} not found`);

    if (submission.userId !== requester.id) {
      if (requester.role === Role.STUDENT) throw new ForbiddenException('That submission is not yours');
      await this.assertCanSeeStudent(submission.userId, requester);
    }

    const forStudent = requester.role === Role.STUDENT;
    const hiddenFlags = submission.problem.testCases
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((tc) => tc.isHidden);

    const testResults = submission.testResults.map((r, i) => ({
      input: r.input,
      expected: r.expected,
      actual: r.actual,
      passed: r.passed,
      stderr: r.stderr,
      exitCode: r.exitCode,
      timedOut: r.timedOut,
      executionMs: r.executionMs,
      isHidden: hiddenFlags[i] ?? false,
    }));

    return this.toResponse(submission, submission.problem.points, testResults, null, forStudent, {
      code: submission.code,
      problemTitle: submission.problem.title,
    });
  }

  /** Every submission for a problem — class analytics for teachers. */
  async findForProblem(problemId: string, query: QuerySubmissionsDto, requester: AuthenticatedUser) {
    const where: Prisma.SubmissionWhereInput = { problemId };
    if (query.userId) where.userId = query.userId;
    if (typeof query.passed === 'boolean') where.passed = query.passed;
    if (query.language) where.language = query.language;

    // Teachers only see students from their own classes.
    if (requester.role === Role.TEACHER) {
      where.user = { enrollments: { some: { class: { teacherId: requester.id } } } };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.submission.findMany({
        where,
        orderBy: orderByFrom(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.limit,
        select: {
          id: true,
          userId: true,
          language: true,
          passed: true,
          score: true,
          attemptNumber: true,
          executionMs: true,
          createdAt: true,
          user: { select: { username: true, displayName: true, avatar: true } },
        },
      }),
      this.prisma.submission.count({ where }),
    ]);

    return paginated(rows, total, query);
  }

  private async assertCanSeeStudent(userId: string, requester: AuthenticatedUser): Promise<void> {
    if (requester.role === Role.ADMIN) return;
    const shared = await this.prisma.enrollment.count({
      where: { userId, class: { teacherId: requester.id } },
    });
    if (shared === 0) throw new ForbiddenException('That student is not in any of your classes');
  }

  // ── shaping ────────────────────────────────────────────────────────

  private toResponse(
    submission: {
      id: string;
      problemId: string;
      userId: string;
      examAttemptId: string | null;
      language: Language;
      status: SubmissionStatus;
      passed: boolean;
      score: number;
      attemptNumber: number;
      compileError: string | null;
      executionMs: number | null;
      createdAt: Date;
    },
    maxScore: number,
    testResults: SubmissionResponse['testResults'],
    reward: AwardResult | null,
    forStudent: boolean,
    extra: Record<string, unknown> = {},
  ): SubmissionResponse {
    // Same rule as the live evaluation: a hidden case reveals nothing but its
    // verdict, or a student can read it back out of stdout, stderr or the exit
    // code. Stored results go through this too, not just fresh ones.
    const visible = forStudent
      ? testResults.map((r) =>
          r.isHidden
            ? {
                ...r,
                input: 'hidden',
                expected: 'hidden',
                actual: r.actual === null ? null : 'hidden',
                stdout: null,
                stderr: r.stderr ? HIDDEN_ERROR_NOTICE : null,
                exitCode: null,
              }
            : r,
        )
      : testResults;

    return {
      id: submission.id,
      problemId: submission.problemId,
      userId: submission.userId,
      examAttemptId: submission.examAttemptId,
      language: submission.language,
      status: submission.status,
      passed: submission.passed,
      score: submission.score,
      maxScore,
      attemptNumber: submission.attemptNumber,
      compileError: submission.compileError,
      executionMs: submission.executionMs,
      createdAt: submission.createdAt,
      passedCount: testResults.filter((r) => r.passed).length,
      totalCount: testResults.length,
      testResults: visible,
      reward,
      ...extra,
    };
  }
}

/** An attempt ends at start + duration, never past the exam window plus grace. */
export function examDeadline(
  startedAt: Date,
  exam: { durationMin: number; scheduledEnd: Date; gracePeriodMin: number },
): Date {
  const byDuration = startedAt.getTime() + exam.durationMin * 60_000;
  const byWindow = exam.scheduledEnd.getTime() + exam.gracePeriodMin * 60_000;
  return new Date(Math.min(byDuration, byWindow));
}
