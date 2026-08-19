import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '@simulyn/shared';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { MentorService } from '../mentor/mentor.service';

const ACTIVE_WINDOW_DAYS = 7;

export interface CategoryStat {
  category: string;
  attempts: number;
  passed: number;
  accuracy: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mentor: MentorService,
  ) {}

  private async assertTeaches(classId: string, requester: AuthenticatedUser) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException(`Class ${classId} not found`);
    if (requester.role !== Role.ADMIN && cls.teacherId !== requester.id) {
      throw new ForbiddenException('You do not teach this class');
    }
    return cls;
  }

  // ── class overview ─────────────────────────────────────────────────

  async classOverview(classId: string, requester: AuthenticatedUser) {
    const cls = await this.assertTeaches(classId, requester);

    const [enrollments, assigned, exams] = await Promise.all([
      this.prisma.enrollment.findMany({ where: { classId }, select: { userId: true } }),
      this.prisma.classProblem.findMany({ where: { classId }, select: { problemId: true } }),
      this.prisma.exam.count({ where: { classId } }),
    ]);

    const userIds = enrollments.map((e) => e.userId);
    if (userIds.length === 0) {
      return {
        class: { id: cls.id, name: cls.name, code: cls.code },
        students: 0,
        assignedProblems: assigned.length,
        exams,
        totalSubmissions: 0,
        passedSubmissions: 0,
        averageAccuracy: 0,
        activeStudents: 0,
        problemsSolved: 0,
        categories: [] as CategoryStat[],
        weakestCategories: [] as CategoryStat[],
      };
    }

    const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000);

    const [submissions, activeRows] = await Promise.all([
      this.prisma.submission.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          problemId: true,
          passed: true,
          problem: { select: { category: true } },
        },
      }),
      this.prisma.submission.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, createdAt: { gte: since } },
      }),
    ]);

    const byCategory = new Map<string, { attempts: number; passed: number }>();
    const solved = new Set<string>();

    for (const s of submissions) {
      const key = s.problem.category;
      const entry = byCategory.get(key) ?? { attempts: 0, passed: 0 };
      entry.attempts += 1;
      if (s.passed) {
        entry.passed += 1;
        solved.add(`${s.userId}:${s.problemId}`);
      }
      byCategory.set(key, entry);
    }

    const categories: CategoryStat[] = [...byCategory.entries()]
      .map(([category, v]) => ({
        category,
        attempts: v.attempts,
        passed: v.passed,
        accuracy: v.attempts === 0 ? 0 : Math.round((v.passed / v.attempts) * 100),
      }))
      .sort((a, b) => b.attempts - a.attempts);

    const passedSubmissions = submissions.filter((s) => s.passed).length;

    return {
      class: { id: cls.id, name: cls.name, code: cls.code },
      students: userIds.length,
      assignedProblems: assigned.length,
      exams,
      totalSubmissions: submissions.length,
      passedSubmissions,
      averageAccuracy:
        submissions.length === 0 ? 0 : Math.round((passedSubmissions / submissions.length) * 100),
      activeStudents: activeRows.length,
      problemsSolved: solved.size,
      categories,
      weakestCategories: [...categories]
        .filter((c) => c.attempts >= 2)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 3),
    };
  }

  // ── per-student breakdown ──────────────────────────────────────────

  async classStudents(classId: string, requester: AuthenticatedUser) {
    await this.assertTeaches(classId, requester);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            lastLoginAt: true,
            gamification: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const userIds = enrollments.map((e) => e.userId);
    if (userIds.length === 0) return [];

    const [submissions, violations] = await Promise.all([
      this.prisma.submission.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, problemId: true, passed: true, score: true, createdAt: true },
      }),
      this.prisma.violation.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
    ]);

    const violationsByUser = new Map(violations.map((v) => [v.userId, v._count._all]));

    return enrollments.map((e) => {
      const own = submissions.filter((s) => s.userId === e.userId);
      const passed = own.filter((s) => s.passed);
      const solvedProblems = new Set(passed.map((s) => s.problemId));
      const lastSubmission = own.reduce<Date | null>(
        (latest, s) => (latest === null || s.createdAt > latest ? s.createdAt : latest),
        null,
      );

      return {
        user: {
          id: e.user.id,
          username: e.user.username,
          displayName: e.user.displayName,
          avatar: e.user.avatar,
        },
        problemsSolved: solvedProblems.size,
        totalSubmissions: own.length,
        passedSubmissions: passed.length,
        accuracy: own.length === 0 ? 0 : Math.round((passed.length / own.length) * 100),
        averageScore:
          own.length === 0 ? 0 : Math.round(own.reduce((s, r) => s + r.score, 0) / own.length),
        violations: violationsByUser.get(e.userId) ?? 0,
        xp: e.user.gamification?.xp ?? 0,
        level: e.user.gamification?.level ?? 1,
        currentStreak: e.user.gamification?.currentStreak ?? 0,
        lastSubmissionAt: lastSubmission,
        lastLoginAt: e.user.lastLoginAt,
      };
    });
  }

  // ── problem stats ──────────────────────────────────────────────────

  async problemStats(problemId: string, requester: AuthenticatedUser) {
    const problem = await this.prisma.problem.findUnique({
      where: { id: problemId },
      select: { id: true, title: true, difficulty: true, category: true, points: true, type: true },
    });
    if (!problem) throw new NotFoundException(`Problem ${problemId} not found`);

    const where =
      requester.role === Role.TEACHER
        ? { problemId, user: { enrollments: { some: { class: { teacherId: requester.id } } } } }
        : { problemId };

    const submissions = await this.prisma.submission.findMany({
      where,
      select: {
        userId: true,
        passed: true,
        language: true,
        attemptNumber: true,
        executionMs: true,
        compileError: true,
        createdAt: true,
        testResults: { select: { passed: true, stderr: true, timedOut: true } },
      },
    });

    const attempted = new Set(submissions.map((s) => s.userId));
    const solvers = new Set(submissions.filter((s) => s.passed).map((s) => s.userId));

    // Attempts each solver needed before their first pass.
    const attemptsToSolve: number[] = [];
    for (const userId of solvers) {
      const first = submissions
        .filter((s) => s.userId === userId && s.passed)
        .sort((a, b) => a.attemptNumber - b.attemptNumber)[0];
      if (first) attemptsToSolve.push(first.attemptNumber);
    }

    const byLanguage = new Map<string, { attempts: number; passed: number }>();
    for (const s of submissions) {
      const entry = byLanguage.get(s.language) ?? { attempts: 0, passed: 0 };
      entry.attempts += 1;
      if (s.passed) entry.passed += 1;
      byLanguage.set(s.language, entry);
    }

    // Common failure modes, bucketed by the first line of the error.
    const errors = new Map<string, number>();
    let timeouts = 0;
    for (const s of submissions) {
      if (s.compileError) {
        const key = `compile: ${s.compileError.split('\n')[0].slice(0, 120)}`;
        errors.set(key, (errors.get(key) ?? 0) + 1);
      }
      for (const r of s.testResults) {
        if (r.timedOut) timeouts += 1;
        if (!r.passed && r.stderr) {
          const key = `runtime: ${r.stderr.split('\n').filter(Boolean).pop()?.slice(0, 120) ?? 'error'}`;
          errors.set(key, (errors.get(key) ?? 0) + 1);
        }
      }
    }

    const durations = submissions
      .map((s) => s.executionMs)
      .filter((ms): ms is number => typeof ms === 'number');

    return {
      problem,
      totalSubmissions: submissions.length,
      studentsAttempted: attempted.size,
      studentsSolved: solvers.size,
      passRate:
        attempted.size === 0 ? 0 : Math.round((solvers.size / attempted.size) * 100),
      submissionPassRate:
        submissions.length === 0
          ? 0
          : Math.round((submissions.filter((s) => s.passed).length / submissions.length) * 100),
      averageAttemptsToSolve:
        attemptsToSolve.length === 0
          ? 0
          : Math.round(
              (attemptsToSolve.reduce((a, b) => a + b, 0) / attemptsToSolve.length) * 10,
            ) / 10,
      averageExecutionMs:
        durations.length === 0
          ? 0
          : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      timeouts,
      byLanguage: [...byLanguage.entries()].map(([language, v]) => ({
        language,
        attempts: v.attempts,
        passed: v.passed,
        accuracy: v.attempts === 0 ? 0 : Math.round((v.passed / v.attempts) * 100),
      })),
      commonErrors: [...errors.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([message, count]) => ({ message, count })),
    };
  }

  // ── AI classroom insights ──────────────────────────────────────────

  async classroomInsights(classId: string, requester: AuthenticatedUser) {
    const overview = await this.classOverview(classId, requester);
    const students = await this.classStudents(classId, requester);

    // Names are deliberately left out of the prompt — only the count is sent.
    const struggling = students.filter((s) => s.totalSubmissions > 0 && s.accuracy < 50);

    const system = [
      'You are an experienced computer science instructor advising a colleague.',
      'You are given aggregated, anonymised class statistics.',
      'Reply with three short markdown sections: "What is going well", "Where the class is struggling", and "Suggested next steps" (3 concrete actions).',
      'Be specific and reference the numbers. Keep the whole reply under 250 words. Never invent data.',
    ].join(' ');

    const prompt = [
      `Class: ${overview.class.name} (${overview.students} students, ${overview.assignedProblems} assigned problems)`,
      `Submissions: ${overview.totalSubmissions} total, ${overview.averageAccuracy}% pass rate`,
      `Active in the last ${ACTIVE_WINDOW_DAYS} days: ${overview.activeStudents} of ${overview.students}`,
      `Distinct problems solved across the class: ${overview.problemsSolved}`,
      '',
      'Accuracy by category:',
      ...overview.categories.map((c) => `- ${c.category}: ${c.accuracy}% over ${c.attempts} attempts`),
      '',
      `Students below 50% accuracy: ${struggling.length}`,
    ].join('\n');

    const reply = await this.mentor.complete(system, prompt);

    return {
      stats: overview,
      insights: reply.ok ? reply.text : null,
      provider: reply.provider,
      error: reply.ok ? null : reply.error,
    };
  }
}
