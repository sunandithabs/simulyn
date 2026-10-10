import { Injectable } from '@nestjs/common';
import { Role } from '@simulyn/shared';

import { ANALYTICS_EXCLUDED_USERNAMES } from '../../common/constants';
import { PrismaService } from '../../prisma/prisma.service';

const SUS_ITEMS = 10;

function sorted(nums: number[]) {
  return [...nums].sort((a, b) => a - b);
}
function mean(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
function median(nums: number[]) {
  if (!nums.length) return null;
  const s = sorted(nums);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function stdev(nums: number[]) {
  if (nums.length < 2) return null;
  const m = mean(nums)!;
  return Math.sqrt(nums.reduce((a, b) => a + (b - m) ** 2, 0) / (nums.length - 1));
}
const round = (n: number | null, d = 1) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Sauro & Lewis adjective/grade bands for the SUS score. */
function susBand(score: number) {
  if (score >= 80.3) return 'A (excellent)';
  if (score >= 68) return 'B/C (good–OK)';
  if (score >= 51) return 'D (poor)';
  return 'F (awful)';
}

function parseAnswers(raw: string): number[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(Number) : [];
  } catch {
    return [];
  }
}

@Injectable()
export class ResearchInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Participants: all students except explicitly excluded usernames. */
  private readonly realStudent = {
    role: Role.STUDENT,
    username: { notIn: ANALYTICS_EXCLUDED_USERNAMES },
  };

  async feedback() {
    const rows = await this.prisma.surveyResponse.findMany({
      where: { user: this.realStudent },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, susScore: true, quickScore: true, susAnswers: true, freeText: true, createdAt: true },
    });
    // Anonymous on purpose: participants consented to a pseudonymised study.
    return rows.map((r, i) => ({
      id: r.id,
      participant: `P${String(rows.length - i).padStart(2, '0')}`,
      kind: r.kind === 'QUICK' ? 'QUICK' : 'SUS',
      susScore: r.kind === 'QUICK' ? null : r.susScore,
      quickScore: r.kind === 'QUICK' ? r.quickScore : null,
      band: r.kind !== 'QUICK' && r.susScore !== null ? susBand(r.susScore) : null,
      answers: parseAnswers(r.susAnswers),
      freeText: r.freeText?.trim() || null,
      submittedAt: r.createdAt,
    }));
  }

  async summary() {
    const since14 = new Date(Date.now() - 14 * 86_400_000);
    const userWhere = this.realStudent;
    const byUser = { user: userWhere };

    const [students, consented, surveys, submissions, attempts, violations, activeIds, demoCount] =
      await Promise.all([
        this.prisma.user.count({ where: userWhere }),
        this.prisma.studyConsent.count({ where: byUser }),
        this.prisma.surveyResponse.findMany({ where: byUser, select: { kind: true, susScore: true, quickScore: true, susAnswers: true, freeText: true } }),
        this.prisma.submission.findMany({
          where: byUser,
          select: { userId: true, passed: true, score: true, language: true, createdAt: true },
        }),
        this.prisma.examAttempt.findMany({
          where: byUser,
          select: { submittedAt: true, flagged: true, terminated: true, integrityScore: true },
        }),
        this.prisma.violation.count({ where: byUser }),
        this.prisma.user.findMany({
          where: { ...userWhere, OR: [{ lastLoginAt: { gte: since14 } }, { submissions: { some: { createdAt: { gte: since14 } } } }] },
          select: { id: true },
        }),
        this.prisma.user.count({ where: { username: { in: ANALYTICS_EXCLUDED_USERNAMES } } }),
      ]);

    // Full 10-item SUS responses only; the 3-question quick survey is reported separately.
    const full = surveys.filter((s) => s.kind !== 'QUICK' && s.susScore !== null);
    const quick = surveys.filter((s) => s.kind === 'QUICK' && s.quickScore !== null);
    const scores = full.map((s) => s.susScore as number);
    const answers = full.map((s) => parseAnswers(s.susAnswers));
    const quickAnswers = quick.map((s) => parseAnswers(s.susAnswers));
    const itemMeans = Array.from({ length: SUS_ITEMS }, (_, i) => round(mean(answers.map((a) => a[i])), 2));
    const bands: Record<string, number> = {};
    scores.forEach((s) => {
      const b = susBand(s);
      bands[b] = (bands[b] ?? 0) + 1;
    });

    // Usage
    const solvers = new Set(submissions.filter((s) => s.passed).map((s) => s.userId));
    const perLanguage: Record<string, { submissions: number; passed: number }> = {};
    const perDay: Record<string, number> = {};
    for (const s of submissions) {
      const l = (perLanguage[s.language] ??= { submissions: 0, passed: 0 });
      l.submissions++;
      if (s.passed) l.passed++;
      const day = s.createdAt.toISOString().slice(0, 10);
      perDay[day] = (perDay[day] ?? 0) + 1;
    }
    const submittedAttempts = attempts.filter((a) => a.submittedAt);

    return {
      scope: 'STUDENT accounts, minus any usernames listed in ANALYTICS_EXCLUDE_USERNAMES',
      excludedDemoAccounts: demoCount,
      participants: {
        registered: students,
        consented,
        surveyed: surveys.length,
        surveyResponseRate: students ? round((surveys.length / students) * 100) : null,
        activeLast14Days: activeIds.length,
        withAtLeastOneSubmission: new Set(submissions.map((s) => s.userId)).size,
        withAtLeastOneSolve: solvers.size,
      },
      sus: {
        n: scores.length,
        mean: round(mean(scores)),
        median: round(median(scores)),
        stdev: round(stdev(scores)),
        min: scores.length ? Math.min(...scores) : null,
        max: scores.length ? Math.max(...scores) : null,
        bands,
        // Items 1,3,5,7,9 are positively worded, 2,4,6,8,10 negatively worded.
        itemMeans,
        commentsCount: surveys.filter((s) => s.freeText?.trim()).length,
      },
      quick: {
        n: quick.length,
        meanScore: round(mean(quick.map((s) => s.quickScore as number))),
        itemMeans: [0, 1, 2].map((i) => round(mean(quickAnswers.map((a) => a[i])), 2)),
      },
      usage: {
        submissions: submissions.length,
        passRate: submissions.length ? round((submissions.filter((s) => s.passed).length / submissions.length) * 100) : null,
        averageScore: round(mean(submissions.map((s) => s.score))),
        perLanguage,
        perDay: Object.entries(perDay)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count })),
      },
      exams: {
        attempts: attempts.length,
        submitted: submittedAttempts.length,
        flagged: attempts.filter((a) => a.flagged).length,
        terminated: attempts.filter((a) => a.terminated).length,
        averageIntegrity: round(mean(attempts.map((a) => a.integrityScore))),
        violations,
      },
    };
  }
}
