import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@simulyn/shared';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return lines.join('\n');
}

function assertResearcher(user: AuthenticatedUser) {
  if (user.role !== Role.TEACHER && user.role !== Role.ADMIN) {
    throw new BadRequestException('Only teachers/admins can export study data');
  }
}

@Injectable()
export class ResearchService {
  constructor(private readonly prisma: PrismaService) {}

  // ── participant-facing: consent + exit survey ──────────────────────

  async recordConsent(userId: string) {
    return this.prisma.studyConsent.upsert({
      where: { userId },
      create: { userId, consented: true, ageConfirm: true },
      update: { consented: true },
    });
  }

  async status(userId: string) {
    const [consent, survey] = await Promise.all([
      this.prisma.studyConsent.findUnique({ where: { userId }, select: { userId: true } }),
      this.prisma.surveyResponse.findUnique({ where: { userId }, select: { userId: true } }),
    ]);
    return { consented: !!consent, surveyed: !!survey };
  }

  async recordSurvey(userId: string, susAnswers: number[], freeText?: string) {
    if (susAnswers.length !== 10 || susAnswers.some((a) => a < 1 || a > 5)) {
      throw new BadRequestException('susAnswers must be 10 integers between 1 and 5');
    }
    // Standard SUS scoring: odd items (1-indexed) contribute (score-1),
    // even items contribute (5-score); sum * 2.5 -> 0-100.
    let total = 0;
    susAnswers.forEach((score, i) => {
      total += i % 2 === 0 ? score - 1 : 5 - score;
    });
    const susScore = total * 2.5;

    return this.prisma.surveyResponse.upsert({
      where: { userId },
      create: { userId, susAnswers: JSON.stringify(susAnswers), susScore, freeText },
      update: { susAnswers: JSON.stringify(susAnswers), susScore, freeText },
    });
  }

  // ── researcher-facing: pseudonymized export ─────────────────────────
  // Every table is keyed by userId only (no email/name), and a stable
  // per-export pseudonym map is generated so the CSVs can be joined
  // without re-identifying anyone from the export itself.

  async exportStudyData(requester: AuthenticatedUser) {
    assertResearcher(requester);

    const [users, submissions, testResults, violations, examAttempts, consents, surveys] =
      await Promise.all([
        this.prisma.user.findMany({ select: { id: true, role: true, createdAt: true } }),
        this.prisma.submission.findMany({
          select: {
            id: true,
            userId: true,
            problemId: true,
            language: true,
            passed: true,
            score: true,
            createdAt: true,
          },
        }),
        this.prisma.testResult.findMany({
          select: { id: true, submissionId: true, passed: true, timedOut: true },
        }),
        this.prisma.violation.findMany({
          select: {
            id: true,
            examAttemptId: true,
            userId: true,
            typeKey: true,
            weight: true,
            timeRemaining: true,
            createdAt: true,
          },
        }),
        this.prisma.examAttempt.findMany({
          select: {
            id: true,
            examId: true,
            userId: true,
            startedAt: true,
            submittedAt: true,
            autoSubmitted: true,
            totalScore: true,
            integrityScore: true,
            flagged: true,
            terminated: true,
            violationBaseline: true,
          },
        }),
        this.prisma.studyConsent.findMany({ select: { userId: true, createdAt: true } }),
        this.prisma.surveyResponse.findMany({
          select: { userId: true, susAnswers: true, susScore: true, freeText: true },
        }),
      ]);

    // Pseudonym map: pXXX in a stable but arbitrary order per export.
    const idMap = new Map<string, string>();
    users.forEach((u, i) => idMap.set(u.id, `p${String(i + 1).padStart(3, '0')}`));
    const pseudo = (id: string) => idMap.get(id) ?? id;

    const files: Record<string, string> = {
      participants: toCsv(
        users.map((u) => ({ participantId: pseudo(u.id), role: u.role, createdAt: u.createdAt })),
      ),
      submissions: toCsv(
        submissions.map((s) => ({
          submissionId: s.id,
          participantId: pseudo(s.userId),
          problemId: s.problemId,
          language: s.language,
          passed: s.passed,
          score: s.score,
          createdAt: s.createdAt,
        })),
      ),
      test_results: toCsv(testResults),
      violations: toCsv(
        violations.map((v) => ({
          violationId: v.id,
          examAttemptId: v.examAttemptId,
          participantId: pseudo(v.userId),
          type: v.typeKey,
          weight: v.weight,
          timeRemainingSec: v.timeRemaining,
          createdAt: v.createdAt,
        })),
      ),
      exam_attempts: toCsv(
        examAttempts.map((a) => ({
          attemptId: a.id,
          examId: a.examId,
          participantId: pseudo(a.userId),
          startedAt: a.startedAt,
          submittedAt: a.submittedAt,
          autoSubmitted: a.autoSubmitted,
          totalScore: a.totalScore,
          integrityScore: a.integrityScore,
          flagged: a.flagged,
          terminated: a.terminated,
          violationBaseline: a.violationBaseline,
        })),
      ),
      consent: toCsv(
        consents.map((c) => ({ participantId: pseudo(c.userId), consentedAt: c.createdAt })),
      ),
      survey_sus: toCsv(
        surveys.map((s) => ({
          participantId: pseudo(s.userId),
          susScore: s.susScore,
          susAnswers: s.susAnswers,
          freeText: s.freeText ?? '',
        })),
      ),
    };

    return files;
  }
}
