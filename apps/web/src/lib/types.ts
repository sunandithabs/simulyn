/** Response shapes returned by the SIMULYN API (apps/api). */

export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type ProblemType = 'PROGRAMMING' | 'ELECTRONICS';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type LanguageEnum = 'PYTHON' | 'JAVASCRIPT' | 'CPP' | 'JAVA';
export type LangKey = 'python' | 'javascript' | 'cpp' | 'java';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string | null;
  role: Role;
  mustChangePassword: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface ElectronicsQuestion {
  id: string;
  text: string;
  answer?: number;
  tolerance: number;
  unit?: string;
}

export interface TestCaseView {
  id: string;
  input: string;
  expected: string;
  isHidden: boolean;
  order: number;
}

export interface Problem {
  id: string;
  type: ProblemType;
  difficulty: Difficulty;
  category: string;
  title: string;
  description: string;
  constraints: string[];
  points: number;
  tags: string[];
  isPublished: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  starterCode: Partial<Record<LangKey, string>> | null;
  harness: unknown;
  examples: ProblemExample[] | null;
  params: Record<string, unknown> | null;
  questions: ElectronicsQuestion[] | null;
  testCases?: TestCaseView[];
  hints?: { id: string; level: number; text: string }[];
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  compileError: string | null;
  errorLine?: number | null;
  executionMs: number;
}

export interface TestOutcome {
  index: number;
  isHidden: boolean;
  input: string;
  expected: string;
  actual: string | null;
  /** What the student's own print/console calls produced, if anything. */
  stdout?: string | null;
  passed: boolean;
  verdict?: 'AC' | 'WA' | 'RE' | 'TLE' | 'NO_OUTPUT';
  stderr: string | null;
  exitCode: number | null;
  timedOut: boolean;
  executionMs: number;
}

export interface EvaluationResult {
  ok: boolean;
  allPassed: boolean;
  compileError: string | null;
  errorLine?: number | null;
  results: TestOutcome[];
  passedCount: number;
  totalCount: number;
  totalMs: number;
}

export interface BadgeAward {
  key: string;
  name: string;
  icon: string;
  description: string;
}

export interface Reward {
  xp: number;
  xpAwarded: number;
  level: number;
  leveledUp: boolean;
  currentStreak: number;
  longestStreak: number;
  problemsSolved: number;
  newBadges: BadgeAward[];
}

export interface Submission {
  id: string;
  problemId: string;
  userId: string;
  examAttemptId: string | null;
  language: LanguageEnum;
  status: string;
  passed: boolean;
  score: number;
  maxScore: number;
  attemptNumber: number;
  compileError: string | null;
  errorLine?: number | null;
  executionMs: number | null;
  createdAt: string;
  passedCount: number;
  totalCount: number;
  testResults: Omit<TestOutcome, 'index'>[];
  reward: Reward | null;
  problemTitle?: string;
  code?: string;
}

export interface SubmissionListRow {
  id: string;
  problemId: string;
  userId: string;
  examAttemptId: string | null;
  language: LanguageEnum;
  status: string;
  passed: boolean;
  score: number;
  attemptNumber: number;
  executionMs: number | null;
  compileError: string | null;
  createdAt: string;
  problem: { title: string; difficulty: Difficulty; category: string; points: number };
  _count: { testResults: number };
}

export interface ElectronicsOutcome {
  questionId: string;
  text: string;
  expected: number;
  actual: number | null;
  tolerance: number;
  unit: string | null;
  correct: boolean;
}

export interface ElectronicsResult {
  allCorrect: boolean;
  score: number;
  correctCount: number;
  totalCount: number;
  results: ElectronicsOutcome[];
}

export interface GamificationMe {
  xp: number;
  level: number;
  levelThresholds: number[];
  xpToNextLevel: number | null;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  problemsSolved: number;
  rank: number;
  badges: { key: string; name: string; description: string; icon: string; earnedAt: string }[];
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  xp: number;
  level: number;
  problemsSolved: number;
  currentStreak: number;
  isCurrentUser: boolean;
}

export interface BadgeRow {
  key: string;
  name: string;
  description: string;
  icon: string;
  condition: { type: string; threshold: number } | null;
  earned: boolean;
  earnedAt: string | null;
}

export interface ClassSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
  semester: string | null;
  teacherId: string;
  isArchived: boolean;
  createdAt: string;
  teacher: { id: string; username: string; displayName: string; avatar: string | null };
  _count: { enrollments: number; assignedProblems: number; exams: number };
}

export interface ExamSummary {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  durationMin: number;
  scheduledStart: string;
  scheduledEnd: string;
  gracePeriodMin: number;
  isPublished: boolean;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED';
  class: { id: string; name: string; code: string };
  _count: { problems: number; attempts: number };
  attempt: {
    id: string;
    startedAt: string;
    submittedAt: string | null;
    autoSubmitted: boolean;
    totalScore: number;
    integrityScore: number;
    /** Only present on the single-exam detail response. */
    terminated?: boolean;
    terminatedReason?: string | null;
    endsAt: string;
  } | null;
}

export interface UserStats {
  userId: string;
  username: string;
  displayName: string;
  problemsSolved: number;
  totalSubmissions: number;
  passedSubmissions: number;
  accuracy: number;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

export interface MentorHint {
  text: string;
  hintLevel: number;
  provider: string;
  cached: boolean;
  latencyMs: number;
}

// ── Phase 5: teaching, exams, proctoring, discussion ──

export interface ClassStudentProgress {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  joinedAt: string;
  problemsSolved: number;
  assignedProblems: number;
  totalSubmissions: number;
  passedSubmissions: number;
  accuracy: number;
  xp: number;
  level: number;
  currentStreak: number;
}

export interface ClassProblemAssignment {
  id: string;
  dueDate: string | null;
  assignedAt: string;
  problem: Problem;
}

export interface CategoryStat {
  category: string;
  attempts: number;
  passed: number;
  accuracy: number;
}

export interface ClassOverview {
  class: { id: string; name: string; code: string };
  students: number;
  assignedProblems: number;
  exams: number;
  totalSubmissions: number;
  passedSubmissions: number;
  averageAccuracy: number;
  activeStudents: number;
  problemsSolved: number;
  categories: CategoryStat[];
  weakestCategories: CategoryStat[];
}

export interface ClassroomInsights {
  stats: ClassOverview;
  insights: string | null;
  provider: string;
  error: string | null;
}

export interface AnalyticsStudentRow {
  user: { id: string; username: string; displayName: string; avatar: string | null };
  problemsSolved: number;
  totalSubmissions: number;
  passedSubmissions: number;
  accuracy: number;
  averageScore: number;
  violations: number;
  xp: number;
  level: number;
  currentStreak: number;
  lastSubmissionAt: string | null;
  lastLoginAt: string | null;
}

export interface ExamDetail extends ExamSummary {
  createdById: string;
  problems:
    | { id: string; order: number; points: number; problem: Problem }[]
    | null;
}

export interface ExamStartResponse {
  attemptId: string;
  examId: string;
  title: string;
  startedAt: string;
  endsAt: string;
  durationMin: number;
  integrityScore: number;
  questions: { index: number; examProblemId: string; points: number; problem: Problem }[];
}

export interface ExamAttemptRow {
  attemptId: string;
  user: { id: string; username: string; displayName: string; avatar: string | null };
  startedAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  totalScore: number;
  maxScore: number;
  percentage: number;
  integrityScore: number;
  flagged: boolean;
  violationCount: number;
  submissionCount: number;
  timeTakenMin: number | null;
  status: 'SUBMITTED' | 'IN_PROGRESS';
}

export interface ExamResults {
  exam: { id: string; title: string; status: ExamSummary['status']; maxScore: number };
  summary: {
    enrolled: number;
    started: number;
    submitted: number;
    notStarted: number;
    averageScore: number;
    averageIntegrity: number;
  };
  attempts: ExamAttemptRow[];
  notStarted: { user: ExamAttemptRow['user']; status: 'NOT_STARTED' }[];
}

export type ViolationTypeKey =
  | 'COPY' | 'PASTE' | 'CUT' | 'RIGHTCLICK' | 'SELECTION' | 'DEVTOOLS' | 'TABSWITCH'
  | 'BLUR' | 'REFRESH' | 'CLOSE' | 'MULTIMONITOR' | 'FULLSCREEN' | 'SCREENSHOT' | 'MANUAL';

export interface RecordedViolation {
  id: string;
  examAttemptId: string;
  examId: string;
  userId: string;
  username: string;
  displayName: string;
  typeKey: ViolationTypeKey;
  label: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  critical: boolean;
  weight: number;
  timeRemaining: number | null;
  integrityScore: number;
  violationCount: number;
  terminated: boolean;
  createdAt: string;
}

export interface StudentTerminatedEvent {
  attemptId: string;
  examId: string;
  userId: string;
  username: string;
  displayName: string;
  reason: string;
  /** Proctor's username, or null when the violation threshold did it. */
  by: string | null;
  violationCount: number;
  integrityScore: number;
  totalScore: number;
  at: string;
}

export interface StudentReadmittedEvent {
  attemptId: string;
  examId: string;
  userId: string;
  username: string;
  displayName: string;
  by: string;
  at: string;
}

export interface StudentFlaggedEvent {
  attemptId: string;
  examId: string;
  userId: string;
  username: string;
  displayName: string;
  violationCount: number;
  integrityScore: number;
  at: string;
}

export interface LiveAttemptRow {
  attemptId: string;
  user: { id: string; username: string; displayName: string; avatar: string | null };
  startedAt: string;
  submittedAt: string | null;
  integrityScore: number;
  flagged: boolean;
  terminated: boolean;
  terminatedReason: string | null;
  terminatedBy: string | null;
  violationCount: number;
  /** Violations counted since the last readmit — what the threshold measures. */
  violationsSinceReadmit: number;
  submissionCount: number;
  recentViolations: { typeKey: ViolationTypeKey; weight: number; createdAt: string }[];
}

export interface ViolationRow {
  id: string;
  examAttemptId: string;
  examId: string;
  user: { id: string; username: string; displayName: string; avatar: string | null };
  typeKey: ViolationTypeKey;
  label: string;
  severity: string;
  critical: boolean;
  weight: number;
  timeRemaining: number | null;
  integrityScore: number;
  codeSnapshot?: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface ProctorNote {
  id: string;
  note: string;
  by: string;
  createdAt: string;
}

// ── Phase 6: administration ──

export interface SystemOverview {
  users: { total: number; students: number; teachers: number; admins: number; inactive: number };
  classes: number;
  problems: { total: number; published: number };
  submissions: number;
  exams: { total: number; active: number };
  attemptsInProgress: number;
}

export interface SystemHealth {
  uptimeSeconds: number;
  startedAt: string;
  node: string;
  platform: string;
  environment: string;
  memory: { rssBytes: number; heapUsedBytes: number; heapTotalBytes: number };
  database: { provider: string; sizeBytes: number | null; path: string | null };
  execution: {
    languages: Record<LangKey, boolean>;
    concurrency: { capacity: number; free: number; queued: number };
    timeoutMs: number;
  };
  websockets: { namespace: string; connected: number };
}

export interface SettingEntry {
  env: string;
  label: string;
  value: string;
  secret?: boolean;
}

export interface SystemSettings {
  readOnly: boolean;
  groups: { key: string; label: string; note?: string; entries: SettingEntry[] }[];
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionPost {
  id: string;
  problemId: string;
  parentId: string | null;
  content: string;
  upvotes: number;
  hasUpvoted: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  isAuthor: boolean;
  canModerate: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; username: string; displayName: string; avatar: string | null; role: Role };
  replies: DiscussionPost[];
}

// ── Hackathons ──

export type HackathonStatus = 'DRAFT' | 'UPCOMING' | 'LIVE' | 'ENDED';

export interface HackathonSummary {
  id: string;
  title: string;
  description: string;
  rules: string | null;
  startsAt: string;
  endsAt: string;
  maxTeamSize: number;
  mode?: 'PROJECT' | 'PROBLEMS';
  criteria: { name: string; max: number }[];
  isPublished: boolean;
  resultsPublished: boolean;
  status: HackathonStatus;
  host: { displayName: string };
  _count: { teams: number };
}

export interface HackathonTeamMember {
  id: string;
  isLeader: boolean;
  user: { id: string; displayName: string; username: string };
}

export interface HackathonSubmissionData {
  id: string;
  title: string;
  description: string;
  repoUrl: string | null;
  demoUrl: string | null;
  submittedAt: string;
}

export interface MyHackathonTeam {
  id: string;
  name: string;
  joinCode: string;
  members: HackathonTeamMember[];
  submission: HackathonSubmissionData | null;
}

export interface HackathonDetail extends HackathonSummary {
  managed: boolean;
  myTeam: MyHackathonTeam | null;
  problems?: { id: string; title: string; difficulty: string; category: string; points: number }[];
}

export interface HackathonScoreboard {
  mode: string;
  rows: { rank?: number; team: string; score?: number; solved?: number; members?: number; submitted?: boolean }[];
}

export interface HackathonInviteRow {
  id: string;
  team: { name: string; hackathon: { id: string; title: string } };
  inviter: { displayName: string; username: string };
}

export interface HackathonTeamAdminRow {
  id: string;
  name: string;
  joinCode: string;
  members: HackathonTeamMember[];
  submission: HackathonSubmissionData | null;
  judgeCount: number;
  averageScore: number | null;
  myScore: { score: number; comment: string | null; breakdown: Record<string, number> | null } | null;
}

export interface HackathonLeaderboardRow {
  rank: number;
  submissionId: string;
  team: string;
  members: string[];
  title: string;
  repoUrl: string | null;
  demoUrl: string | null;
  averageScore: number;
  judgeCount: number;
  comments: string[];
}

// ── Research (real-user SUS + usage) ──

export interface ResearchSummary {
  scope: string;
  excludedDemoAccounts: number;
  participants: {
    registered: number;
    consented: number;
    surveyed: number;
    surveyResponseRate: number | null;
    activeLast14Days: number;
    withAtLeastOneSubmission: number;
    withAtLeastOneSolve: number;
  };
  sus: {
    n: number;
    mean: number | null;
    median: number | null;
    stdev: number | null;
    min: number | null;
    max: number | null;
    bands: Record<string, number>;
    itemMeans: (number | null)[];
    commentsCount: number;
  };
  quick: { n: number; meanScore: number | null; itemMeans: (number | null)[] };
  usage: {
    submissions: number;
    passRate: number | null;
    averageScore: number | null;
    perLanguage: Record<string, { submissions: number; passed: number }>;
    perDay: { date: string; count: number }[];
  };
  exams: {
    attempts: number;
    submitted: number;
    flagged: number;
    terminated: number;
    averageIntegrity: number | null;
    violations: number;
  };
}

export interface SurveyFeedbackRow {
  id: string;
  participant: string;
  kind: 'SUS' | 'QUICK';
  susScore: number | null;
  quickScore: number | null;
  band: string | null;
  answers: number[];
  freeText: string | null;
  submittedAt: string;
}

// ── Teacher profile ──

export interface TeacherCategoryStat {
  category: string;
  attempts: number;
  passed: number;
  accuracy: number;
}

export interface TeacherProfile {
  user: {
    id: string;
    displayName: string;
    username: string;
    email: string;
    avatar: string | null;
    role: Role;
    createdAt: string;
    lastLoginAt: string | null;
  };
  classes: { id: string; name: string; code: string; isArchived: boolean; students: number }[];
  students: { total: number; activeLast7Days: number };
  content: { problemsAuthored: number; problemsPublished: number; announcements: number };
  submissions: { last91Days: number; passRate: number | null };
  exams: {
    total: number;
    byStatus: Record<'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED', number>;
    attempts: number;
    flagged: number;
    terminated: number;
    averageIntegrity: number | null;
  };
  hackathons: {
    total: number;
    byStatus: Record<'DRAFT' | 'UPCOMING' | 'LIVE' | 'ENDED', number>;
    teams: number;
  };
  weakestCategories: TeacherCategoryStat[];
  strongestCategories: TeacherCategoryStat[];
  activityDates: string[];
  recentSubmissions: {
    id: string;
    passed: boolean;
    score: number;
    createdAt: string;
    user: { displayName: string };
    problem: { title: string; points: number };
  }[];
}
