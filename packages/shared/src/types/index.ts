// ── Prisma generated types ──
export { PrismaClient, Prisma } from '@prisma/client';

// Enums are runtime values as well as types.
export {
  Role,
  ProblemType,
  Difficulty,
  Language,
  SubmissionStatus,
  ViolationType,
} from '@prisma/client';

export type {
  User,
  RefreshToken,
  Class,
  Enrollment,
  Problem,
  TestCase,
  Hint,
  ClassProblem,
  Submission,
  TestResult,
  Exam,
  ExamProblem,
  ExamAttempt,
  Violation,
  Gamification,
  Badge,
  UserBadge,
  DiscussionPost,
  DiscussionVote,
  MentorRequest,
  StudyConsent,
  SurveyResponse,
} from '@prisma/client';

// ── JSON column payload shapes ──
export * from './json';
