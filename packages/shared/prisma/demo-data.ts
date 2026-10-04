/**
 * SIMULYN demo data: fills the dashboards with realistic activity.
 *
 * Unlike seed.ts this NEVER deletes real data. It only adds:
 *   - demo students (cannot sign in: their passwords are random and unrecorded)
 *   - 60 days of submissions with test results, in a believable shape
 *   - exams with attempts, scores and proctoring violations
 *   - discussion threads, AI mentor requests, XP, streaks and badges
 * The demo students are enrolled in your existing classes, so teacher and
 * class analytics show real and demo activity together.
 *
 * Every row it creates has an id starting with "demo_", which is how
 * --remove finds exactly what it added and nothing else.
 *
 *   pnpm db:demo                       add demo data (aborts if some exists)
 *   pnpm db:demo --reset               remove the old demo data, then add fresh data
 *   pnpm db:demo:remove                remove all demo data
 *
 * Options: --students=40  --days=60  --class=CODE  --no-upcoming  --seed=1
 *
 * Not generated on purpose: research-study consent and survey rows, so fake
 * rows can never leak into a real study export.
 */
import { randomBytes } from 'node:crypto';

import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { BADGE_DEFINITIONS, levelForXp } from '../src/constants/badge-definitions';
import { FLAG_THRESHOLD, VIOLATION_TYPES } from '../src/constants/violation-types';

const prisma = new PrismaClient();

// ───────────────────────────────────────────────────────────── options ──

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: number): number => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  const value = hit ? Number(hit.split('=')[1]) : NaN;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

const STUDENT_COUNT = Math.min(option('students', 40), 200);
const DAYS = Math.min(option('days', 60), 365);
const SEED = option('seed', 1);
const CLASS_CODE = args.find((a) => a.startsWith('--class='))?.split('=')[1];

const PREFIX = 'demo_';
const DEMO_EXAM_MARK = '[demo]';
const DAY_MS = 86_400_000;

// ─────────────────────────────────────────────────────────────── helpers ──

/** Small seeded generator, so the same --seed always produces the same data. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function weighted<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rand() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const newId = () => `${PREFIX}${randomBytes(9).toString('hex')}`;

function chunks<T>(items: T[], size = 400): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function insertAll<T>(rows: T[], write: (batch: T[]) => Promise<unknown>) {
  for (const batch of chunks(rows)) await write(batch);
}

/** A moment `daysBack` days ago, at a plausible study hour. */
function momentAt(daysBack: number, hour?: number): Date {
  const date = new Date(Date.now() - daysBack * DAY_MS);
  const h = hour ?? weighted([9, 10, 11, 14, 15, 16, 19, 20, 21, 22, 23], [2, 3, 3, 3, 3, 3, 4, 5, 5, 4, 2]);
  date.setHours(h, int(0, 59), int(0, 59), 0);
  if (date.getTime() > Date.now()) return new Date(Date.now() - int(1, 90) * 60_000);
  return date;
}

const dayKey = (d: Date) => Math.floor(new Date(d).setHours(0, 0, 0, 0) / DAY_MS);

// ──────────────────────────────────────────────────────────────── removal ──

/** Removes everything this script ever created, and only that. */
async function removeDemoData() {
  const mine = { startsWith: PREFIX };

  const demoExams = await prisma.exam.findMany({
    where: { OR: [{ id: mine }, { description: { startsWith: DEMO_EXAM_MARK } }] },
    select: { id: true },
  });
  const examIds = demoExams.map((e) => e.id);

  await prisma.testResult.deleteMany({ where: { id: mine } });
  // Anything attached to a demo exam goes with it, even if a real user started it.
  await prisma.submission.deleteMany({
    where: { OR: [{ id: mine }, { examAttempt: { examId: { in: examIds } } }] },
  });
  await prisma.violation.deleteMany({
    where: { OR: [{ id: mine }, { examAttempt: { examId: { in: examIds } } }] },
  });
  await prisma.examAttempt.deleteMany({ where: { OR: [{ id: mine }, { examId: { in: examIds } }] } });
  await prisma.examProblem.deleteMany({ where: { examId: { in: examIds } } });
  await prisma.exam.deleteMany({ where: { id: { in: examIds } } });

  // Discussion: replies first (parent links have no cascade), including any
  // reply a real user left under a demo post.
  const demoPosts = await prisma.discussionPost.findMany({ where: { id: mine }, select: { id: true } });
  const postIds = demoPosts.map((p) => p.id);
  await prisma.discussionVote.deleteMany({ where: { id: mine } });
  await prisma.discussionPost.deleteMany({ where: { parentId: { in: postIds } } });
  await prisma.discussionPost.deleteMany({ where: { id: mine, NOT: { parentId: null } } });
  await prisma.discussionPost.deleteMany({ where: { id: mine } });

  await prisma.mentorRequest.deleteMany({ where: { id: mine } });
  await prisma.userBadge.deleteMany({ where: { userId: mine } });
  await prisma.gamification.deleteMany({ where: { userId: mine } });
  await prisma.enrollment.deleteMany({ where: { OR: [{ userId: mine }, { classId: mine }] } });
  await prisma.classProblem.deleteMany({ where: { classId: mine } });
  await prisma.class.deleteMany({ where: { id: mine } });
  const removed = await prisma.user.deleteMany({ where: { id: mine } });

  console.log(`✔ Removed demo data (${removed.count} demo students and everything attached to them).`);
}

// ─────────────────────────────────────────────────────────── name pools ──

const FIRST_NAMES = [
  'Aarav', 'Diya', 'Rohan', 'Ananya', 'Karthik', 'Meera', 'Arjun', 'Isha', 'Nikhil', 'Priya',
  'Siddharth', 'Kavya', 'Rahul', 'Neha', 'Varun', 'Tanvi', 'Aditya', 'Shreya', 'Manav', 'Pooja',
  'Harsh', 'Riya', 'Dev', 'Sneha', 'Yash', 'Lakshmi', 'Kunal', 'Divya', 'Pranav', 'Aisha',
  'Tejas', 'Mira', 'Ishaan', 'Naina', 'Rishi', 'Sana', 'Vikram', 'Anika', 'Omkar', 'Zoya',
  'Neel', 'Trisha', 'Farhan', 'Bhavna', 'Chirag', 'Esha', 'Gautam', 'Hema', 'Jatin', 'Kiara',
];

const LANGUAGES = ['PYTHON', 'JAVASCRIPT', 'CPP', 'JAVA'] as const;
type Lang = (typeof LANGUAGES)[number];
const STARTER_KEY: Record<Lang, string> = { PYTHON: 'python', JAVASCRIPT: 'javascript', CPP: 'cpp', JAVA: 'java' };
const COMMENT: Record<Lang, string> = { PYTHON: '#', JAVASCRIPT: '//', CPP: '//', JAVA: '//' };
const BASE_MS: Record<Lang, [number, number]> = {
  PYTHON: [18, 220],
  JAVASCRIPT: [12, 160],
  CPP: [4, 60],
  JAVA: [40, 320],
};

const DIFFICULTY_PENALTY: Record<string, number> = { EASY: 0, MEDIUM: 0.16, HARD: 0.32 };
const DIFFICULTY_ORDER: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

const QUESTIONS = [
  'Does anyone have a hint for {t}? My brute force passes the samples but is far too slow.',
  'I keep failing a hidden case on {t}. What edge cases should I be checking?',
  'What is the expected time complexity for {t}? Trying to work out if O(n log n) is enough.',
  'Is it fine to use extra memory for {t}, or does it have to be in place?',
  'Passed {t} on the first try after drawing out the steps on paper. Worth doing before you code.',
  'Stuck on {t}. Is recursion the intended approach, or can this be done iteratively?',
  'The visualiser really helped me see where my loop went wrong on {t}.',
  'Getting a runtime error on {t} when the input is empty. How are you all handling that?',
];

const REPLIES = [
  'Try tracing it by hand on a tiny input first. The bug usually shows up in two or three steps.',
  'Think about what you could remember between iterations so you do not repeat work.',
  'Check the empty input and the single-element input. Those are the usual hidden cases.',
  'Same problem here. Switching to a hash map fixed the time limit for me.',
  'You do not need extra memory for this one, but it is fine to use it if you are unsure.',
  'The sample cases hide the off-by-one. Print your index right before the return.',
  'Recursion works, but an explicit stack avoids the depth problem on large inputs.',
  'Thanks, that fixed it. I had the loop bound one too high.',
];

const MENTOR_RESPONSES = [
  'What does your function return when the input is empty? Trace that case by hand before changing anything.',
  'Your loop looks right for the first element. What happens on the last iteration?',
  'Think about which value you need to remember from the previous step. Where could you keep it?',
  'Try the smallest input that still breaks. What do your variables hold at each line?',
  'Is there a way to avoid scanning the whole input again for every element?',
  'Your base case may be missing one situation. List all the inputs where the recursion should stop.',
];

const RUNTIME_ERRORS: Record<Lang, string[]> = {
  PYTHON: [
    'Traceback (most recent call last):\n  File "main.py", line 12, in solve\nIndexError: list index out of range',
    "Traceback (most recent call last):\n  File \"main.py\", line 9, in solve\nTypeError: 'NoneType' object is not subscriptable",
    'Traceback (most recent call last):\n  File "main.py", line 15, in solve\nRecursionError: maximum recursion depth exceeded',
  ],
  JAVASCRIPT: [
    "TypeError: Cannot read properties of undefined (reading 'length')",
    "TypeError: Cannot read properties of null (reading 'next')",
  ],
  CPP: ['Segmentation fault (core dumped)', 'terminate called after throwing an instance of std::out_of_range'],
  JAVA: [
    'Exception in thread "main" java.lang.ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 5',
    'Exception in thread "main" java.lang.NullPointerException',
  ],
};

const COMPILE_ERRORS: Record<'CPP' | 'JAVA', string[]> = {
  CPP: [
    "main.cpp:14:21: error: 'vec' was not declared in this scope",
    "main.cpp:9:5: error: expected ';' before '}' token",
  ],
  JAVA: [
    'Main.java:11: error: cannot find symbol\n        int n = nums.size();\n                        ^',
    "Main.java:7: error: incompatible types: possible lossy conversion from long to int",
  ],
};

/** A believable wrong answer for an expected JSON value. */
function wrongAnswer(expected: string): string {
  try {
    const value: unknown = JSON.parse(expected);
    if (typeof value === 'number') return JSON.stringify(value + 1);
    if (typeof value === 'boolean') return JSON.stringify(!value);
    if (typeof value === 'string') return JSON.stringify(`${value}x`);
    if (Array.isArray(value)) {
      const flipped = [...value].reverse();
      return JSON.stringify(JSON.stringify(flipped) === expected ? [...value, 0] : flipped);
    }
  } catch {
    // Not JSON; fall through.
  }
  return 'null';
}

// ───────────────────────────────────────────────────────────────── types ──

interface ProblemRow {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  points: number;
  starter: Record<string, string>;
  cases: { input: string; expected: string }[];
}

interface Student {
  id: string;
  displayName: string;
  skill: number;
  engagement: number;
  /** How many different problems this student will work through (the bank is small). */
  reach: number;
  language: Lang;
  joinedDaysAgo: number;
  categoryBias: Map<string, number>;
}

interface SubmissionDraft {
  row: Prisma.SubmissionCreateManyInput;
  results: Prisma.TestResultCreateManyInput[];
}

// ─────────────────────────────────────────────── submission generation ──

function buildSubmission(opts: {
  student: Student;
  problem: ProblemRow;
  language: Lang;
  passed: boolean;
  createdAt: Date;
  attemptNumber: number;
  examAttemptId?: string;
}): SubmissionDraft {
  const { student, problem, language, passed, createdAt, attemptNumber, examAttemptId } = opts;
  const id = newId();
  const total = problem.cases.length;
  const [msLo, msHi] = BASE_MS[language];
  const code = `${problem.starter[STARTER_KEY[language]] ?? ''}\n${COMMENT[language]} demo submission ${attemptNumber}\n`;

  const row: Prisma.SubmissionCreateManyInput = {
    id,
    userId: student.id,
    problemId: problem.id,
    examAttemptId: examAttemptId ?? null,
    code,
    language,
    status: 'COMPLETED',
    passed,
    score: 0,
    compileError: null,
    executionMs: null,
    attemptNumber,
    createdAt,
  };
  const results: Prisma.TestResultCreateManyInput[] = [];

  if (passed) {
    row.score = problem.points;
    row.executionMs = int(msLo, msHi);
    for (const c of problem.cases) {
      results.push({
        id: newId(),
        submissionId: id,
        input: c.input,
        expected: c.expected,
        actual: c.expected,
        passed: true,
        stderr: null,
        exitCode: 0,
        timedOut: false,
        executionMs: int(msLo, msHi),
      });
    }
    return { row, results };
  }

  // A failure: compile error, runtime error, timeout or plain wrong answer.
  const compiled = language === 'CPP' || language === 'JAVA';
  const kind = weighted(
    ['compile', 'runtime', 'timeout', 'wrong'] as const,
    [compiled ? 14 : 3, 15, 8, 63],
  );

  if (kind === 'compile') {
    row.compileError = compiled ? pick(COMPILE_ERRORS[language as 'CPP' | 'JAVA']) : pick(RUNTIME_ERRORS[language]);
    return { row, results };
  }

  const passedCases = Math.min(int(0, Math.max(total - 1, 0)), total - 1);
  row.score = Math.round((passedCases / total) * problem.points);
  row.executionMs = kind === 'timeout' ? 8000 : int(msLo, msHi * 2);

  problem.cases.forEach((c, i) => {
    const ok = i < passedCases;
    results.push({
      id: newId(),
      submissionId: id,
      input: c.input,
      expected: c.expected,
      actual: ok ? c.expected : kind === 'wrong' ? wrongAnswer(c.expected) : null,
      passed: ok,
      stderr: !ok && kind === 'runtime' ? pick(RUNTIME_ERRORS[language]) : null,
      exitCode: ok ? 0 : kind === 'runtime' ? 1 : kind === 'timeout' ? null : 0,
      timedOut: !ok && kind === 'timeout',
      executionMs: !ok && kind === 'timeout' ? 8000 : int(msLo, msHi),
    });
  });
  return { row, results };
}

function passChance(student: Student, problem: ProblemRow, priorAttempts: number): number {
  const base = student.skill - (DIFFICULTY_PENALTY[problem.difficulty] ?? 0.16);
  const bias = student.categoryBias.get(problem.category) ?? 0;
  return clamp(base + bias + 0.11 * priorAttempts, 0.04, 0.95);
}

function pickLanguage(student: Student): Lang {
  return rand() < 0.82 ? student.language : pick(LANGUAGES);
}

// ──────────────────────────────────────────────────────────────── main ──

async function main() {
  if (flag('remove')) {
    await removeDemoData();
    return;
  }

  const existing = await prisma.user.count({ where: { id: { startsWith: PREFIX } } });
  if (existing > 0) {
    if (!flag('reset')) {
      console.error(
        `✖ Demo data is already present (${existing} demo students).\n` +
          '  Run with --reset to replace it, or db:demo:remove to delete it.',
      );
      process.exit(1);
    }
    await removeDemoData();
  }

  // ── What to attach the demo data to ──────────────────────────────
  const problemRows = await prisma.problem.findMany({
    where: { type: 'PROGRAMMING', isPublished: true },
    include: { testCases: { orderBy: { order: 'asc' } } },
  });
  const problems: ProblemRow[] = problemRows
    .filter((p) => p.testCases.length > 0)
    .map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      difficulty: p.difficulty,
      points: p.points,
      starter: (() => {
        try {
          return JSON.parse(p.starterCode ?? '{}') as Record<string, string>;
        } catch {
          return {};
        }
      })(),
      cases: p.testCases.map((c) => ({ input: c.input, expected: c.expected })),
    }));

  if (problems.length === 0) {
    console.error('✖ No published programming problems found. Run db:seed or db:bootstrap first.');
    process.exit(1);
  }

  const badges = await prisma.badge.findMany();
  const badgeByKey = Object.fromEntries(badges.map((b) => [b.key, b.id]));
  if (badges.length === 0) {
    for (const def of BADGE_DEFINITIONS) {
      const created = await prisma.badge.create({
        data: {
          key: def.key,
          name: def.name,
          description: def.description,
          icon: def.icon,
          condition: JSON.stringify(def.condition),
        },
      });
      badgeByKey[def.key] = created.id;
    }
  }

  let classes = await prisma.class.findMany({
    where: {
      isArchived: false,
      id: { not: { startsWith: PREFIX } },
      ...(CLASS_CODE ? { code: CLASS_CODE } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });

  if (classes.length === 0) {
    if (CLASS_CODE) {
      console.error(`✖ No class with code ${CLASS_CODE}.`);
      process.exit(1);
    }
    const teacher =
      (await prisma.user.findFirst({ where: { role: 'TEACHER' }, orderBy: { createdAt: 'asc' } })) ??
      (await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } }));
    if (!teacher) {
      console.error('✖ No teacher or admin account exists to own a class. Run db:seed or db:bootstrap first.');
      process.exit(1);
    }
    const made = await prisma.class.create({
      data: {
        id: newId(),
        name: 'Demo Lab Batch',
        code: 'DEMO101',
        description: 'Generated demo class.',
        semester: 'Demo',
        teacherId: teacher.id,
      },
    });
    await prisma.classProblem.createMany({
      data: problemRows.map((p) => ({ id: newId(), classId: made.id, problemId: p.id })),
    });
    classes = [made];
  }

  console.log(`▸ Adding ${STUDENT_COUNT} demo students over ${DAYS} days to: ${classes.map((c) => c.code).join(', ')}`);

  // ── Students ─────────────────────────────────────────────────────
  // One unusable hash for everyone: nobody knows the password, so nobody can sign in.
  const unusableHash = await bcrypt.hash(randomBytes(24).toString('hex'), 4);
  const names = shuffle(FIRST_NAMES);
  const categories = [...new Set(problems.map((p) => p.category))];

  const students: Student[] = [];
  const userRows: Prisma.UserCreateManyInput[] = [];

  for (let i = 0; i < STUDENT_COUNT; i++) {
    const first = names[i % names.length];
    const initial = String.fromCharCode(65 + int(0, 25));
    const id = newId();
    const joinedDaysAgo = rand() < 0.75 ? int(Math.floor(DAYS * 0.8), DAYS) : int(2, Math.floor(DAYS * 0.8));
    // Most students are middling, a few are strong, a few struggle or drift away.
    const skill = clamp(0.18 + Math.pow(rand(), 0.85) * 0.72, 0.15, 0.92);
    // A few dormant students, a core of very regular ones, and the rest in between.
    const kind = rand();
    const engagement = kind < 0.12 ? between(0.05, 0.18) : kind < 0.38 ? between(0.8, 1) : between(0.3, 0.75);
    const reach = Math.max(
      1,
      Math.round(problems.length * clamp(skill * 0.85 + engagement * 0.3 - 0.12 + between(-0.2, 0.2), 0.1, 1)),
    );

    students.push({
      id,
      displayName: `${first} ${initial}.`,
      skill,
      engagement,
      reach,
      language: weighted([...LANGUAGES], [55, 12, 20, 13]),
      joinedDaysAgo,
      categoryBias: new Map(categories.map((c) => [c, between(-0.13, 0.13)])),
    });

    const handle = `${PREFIX}${first.toLowerCase()}${String(i + 1).padStart(2, '0')}`;
    userRows.push({
      id,
      email: `${handle}@demo.simulyn.local`,
      username: handle,
      passwordHash: unusableHash,
      displayName: `${first} ${initial}.`,
      role: 'STUDENT',
      isActive: true,
      mustChangePassword: true,
      createdAt: momentAt(joinedDaysAgo, 10),
    });
  }

  // ── Activity simulation: day by day, per student ─────────────────
  const drafts: SubmissionDraft[] = [];
  const activeDays = new Map<string, Set<number>>();
  const solved = new Map<string, Set<string>>();
  const solvedPoints = new Map<string, number>();
  const orderedProblems = [...problems].sort(
    (a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1),
  );

  for (const student of students) {
    const days = new Set<number>();
    const done = new Set<string>();
    const tries = new Map<string, number>();
    const stuck: ProblemRow[] = [];
    activeDays.set(student.id, days);
    solved.set(student.id, done);
    solvedPoints.set(student.id, 0);

    const lastAt = new Map<string, number>();

    for (let back = student.joinedDaysAgo; back >= 0; back--) {
      const weekday = new Date(Date.now() - back * DAY_MS).getDay();
      const weekend = weekday === 0 || weekday === 6;
      const regular = student.engagement >= 0.8;
      // Regular students keep a streak going; the rest skip many days, weekends most of all.
      const chance = regular
        ? (weekend ? 0.93 : 0.98)
        : student.engagement * (weekend ? 0.5 : 0.9) * (0.8 + 0.4 * (1 - back / Math.max(DAYS, 1)));
      if (rand() > chance) continue;

      const sessions = weighted([1, 2, 3], [55, 33, 12]);
      for (let s = 0; s < sessions; s++) {
        let problem: ProblemRow | undefined;
        let practice = false;

        if (stuck.length > 0 && rand() < 0.6) {
          problem = stuck[int(0, stuck.length - 1)];
        } else if (done.size < student.reach) {
          const fresh = orderedProblems.filter((p) => !done.has(p.id) && !stuck.includes(p));
          // Easier problems are reached first, with some wandering.
          problem = fresh[Math.min(fresh.length - 1, Math.floor(Math.pow(rand(), 1.6) * fresh.length))];
        }
        if (!problem && done.size > 0 && rand() < 0.95) {
          // Nothing new to try: redo a solved problem, often in another language.
          const redo = [...done];
          problem = problems.find((p) => p.id === redo[int(0, redo.length - 1)]);
          practice = true;
        }
        if (!problem) continue;

        let when = momentAt(back);
        const floor = lastAt.get(problem.id);
        if (floor !== undefined && when.getTime() <= floor) when = new Date(floor + int(20, 240) * 60_000);
        if (when.getTime() > Date.now() - 60_000) continue;

        const language = practice ? pick(LANGUAGES) : pickLanguage(student);
        let prior = tries.get(problem.id) ?? 0;

        for (let attempt = 0; attempt < 4; attempt++) {
          const passed = practice ? rand() < 0.78 : rand() < passChance(student, problem, prior);
          drafts.push(
            buildSubmission({ student, problem, language, passed, createdAt: when, attemptNumber: prior + 1 }),
          );
          prior += 1;
          tries.set(problem.id, prior);
          lastAt.set(problem.id, when.getTime());
          days.add(dayKey(when));
          when = new Date(when.getTime() + int(2, 28) * 60_000);
          if (when.getTime() > Date.now() - 60_000) break;

          if (passed) {
            // Like the real service, every passing practice attempt earns the problem's points.
            solvedPoints.set(student.id, (solvedPoints.get(student.id) ?? 0) + problem.points);
            done.add(problem.id);
            const at = stuck.indexOf(problem);
            if (at >= 0) stuck.splice(at, 1);
            break;
          }
          if (rand() < 0.2) break; // gave up for now
        }

        if (!done.has(problem.id)) {
          if (prior >= 9) {
            const at = stuck.indexOf(problem);
            if (at >= 0) stuck.splice(at, 1); // abandoned for good
          } else if (!stuck.includes(problem)) {
            stuck.push(problem);
          }
        }
      }
    }
  }

  // ── Exams ────────────────────────────────────────────────────────
  const examRows: Prisma.ExamCreateManyInput[] = [];
  const examProblemRows: Prisma.ExamProblemCreateManyInput[] = [];
  const attemptRows: Prisma.ExamAttemptCreateManyInput[] = [];
  const violationRows: Prisma.ViolationCreateManyInput[] = [];
  const violationKeys = Object.keys(VIOLATION_TYPES).filter((k) => k !== 'MANUAL');

  const enrolment = new Map<string, Student[]>();
  classes.forEach((cls, index) => {
    enrolment.set(
      cls.id,
      students.filter((_, i) => index === 0 || rand() < 0.55 || i < 3),
    );
  });

  const examPlans = [
    { title: 'Weekly Quiz 2', daysBack: 28, minutes: 45, count: 2 },
    { title: 'Mid-term Lab', daysBack: 16, minutes: 90, count: 4 },
    { title: 'Weekly Quiz 4', daysBack: 6, minutes: 45, count: 3 },
  ];

  for (const cls of classes.slice(0, 3)) {
    const roster = enrolment.get(cls.id) ?? [];

    for (const plan of examPlans) {
      if (plan.daysBack >= DAYS) continue;
      const start = momentAt(plan.daysBack, 10);
      const end = new Date(start.getTime() + (plan.minutes + 30) * 60_000);
      const chosen = shuffle(problems).slice(0, Math.min(plan.count, problems.length));
      const examId = newId();

      examRows.push({
        id: examId,
        classId: cls.id,
        title: plan.title,
        description: `${DEMO_EXAM_MARK} Generated exam.`,
        durationMin: plan.minutes,
        scheduledStart: start,
        scheduledEnd: end,
        isPublished: true,
        createdById: cls.teacherId,
        createdAt: new Date(start.getTime() - 5 * DAY_MS),
      });
      chosen.forEach((p, order) =>
        examProblemRows.push({ id: newId(), examId, problemId: p.id, order, points: p.points }),
      );

      for (const student of roster) {
        if (student.joinedDaysAgo < plan.daysBack || rand() > 0.9) continue;

        const attemptId = newId();
        const startedAt = new Date(start.getTime() + int(0, 9) * 60_000);
        const usedFraction = weighted([0.6, 0.8, 0.95, 1], [2, 4, 4, 2]);
        const submittedAt = new Date(startedAt.getTime() + plan.minutes * 60_000 * usedFraction);

        // Proctoring: most students are clean, a few slip, one or two cross the threshold.
        const roll = rand();
        const violationCount =
          roll < 0.68 ? 0 : roll < 0.9 ? int(1, 4) : roll < 0.97 ? int(5, 9) : FLAG_THRESHOLD + int(0, 3);
        let integrity = 100;
        for (let v = 0; v < violationCount; v++) {
          const typeKey = weighted(
            violationKeys,
            violationKeys.map((k) => (k === 'TABSWITCH' || k === 'BLUR' ? 6 : k === 'COPY' || k === 'PASTE' ? 3 : 1)),
          );
          const weight = VIOLATION_TYPES[typeKey as keyof typeof VIOLATION_TYPES]?.weight ?? 5;
          integrity -= weight;
          const offset = between(0.1, usedFraction) * plan.minutes * 60_000;
          violationRows.push({
            id: newId(),
            examAttemptId: attemptId,
            userId: student.id,
            typeKey: typeKey as Prisma.ViolationCreateManyInput['typeKey'],
            weight,
            timeRemaining: Math.max(0, Math.round((plan.minutes * 60_000 - offset) / 1000)),
            createdAt: new Date(startedAt.getTime() + offset),
          });
        }
        const removed = violationCount >= FLAG_THRESHOLD;

        // Their answers: one or two tries per problem, a bit weaker than practice.
        let total = 0;
        for (const problem of chosen) {
          let best = 0;
          for (let attempt = 0; attempt < int(1, 2); attempt++) {
            const passed = rand() < passChance(student, problem, 0) * 0.92;
            const draft = buildSubmission({
              student,
              problem,
              language: pickLanguage(student),
              passed,
              createdAt: new Date(startedAt.getTime() + between(0.1, usedFraction) * plan.minutes * 60_000),
              attemptNumber: attempt + 1,
              examAttemptId: attemptId,
            });
            drafts.push(draft);
            best = Math.max(best, draft.row.score ?? 0);
            if (passed) break;
          }
          total += best;
        }

        attemptRows.push({
          id: attemptId,
          examId,
          userId: student.id,
          startedAt,
          submittedAt,
          autoSubmitted: usedFraction === 1 && rand() < 0.5,
          totalScore: total,
          questionOrder: JSON.stringify(shuffle(chosen.map((p) => p.id))),
          integrityScore: Math.max(0, integrity),
          flagged: violationCount >= FLAG_THRESHOLD,
          terminated: removed,
          terminatedAt: removed ? new Date(startedAt.getTime() + plan.minutes * 30_000) : null,
          terminatedReason: removed ? 'Violation threshold reached' : null,
        });
      }
    }
  }

  // An upcoming exam, so the dashboard shows something scheduled.
  if (!flag('no-upcoming')) {
    for (const cls of classes.slice(0, 3)) {
      const start = new Date(Date.now() + 6 * DAY_MS);
      start.setHours(10, 0, 0, 0);
      const examId = newId();
      examRows.push({
        id: examId,
        classId: cls.id,
        title: 'End-term Lab',
        description: `${DEMO_EXAM_MARK} Generated upcoming exam.`,
        durationMin: 120,
        scheduledStart: start,
        scheduledEnd: new Date(start.getTime() + 150 * 60_000),
        isPublished: true,
        createdById: cls.teacherId,
      });
      shuffle(problems)
        .slice(0, Math.min(5, problems.length))
        .forEach((p, order) =>
          examProblemRows.push({ id: newId(), examId, problemId: p.id, order, points: p.points }),
        );
    }
  }

  // ── Discussions ──────────────────────────────────────────────────
  const postRows: Prisma.DiscussionPostCreateManyInput[] = [];
  const voteRows: Prisma.DiscussionVoteCreateManyInput[] = [];

  for (const problem of shuffle(problems).slice(0, Math.min(8, problems.length))) {
    for (let t = 0; t < int(1, 3); t++) {
      const author = pick(students);
      const postedBack = int(2, Math.max(3, DAYS - 3));
      const topId = newId();
      const created = momentAt(postedBack);
      const upvotes = int(0, Math.min(9, students.length - 1));

      postRows.push({
        id: topId,
        problemId: problem.id,
        authorId: author.id,
        content: pick(QUESTIONS).replace('{t}', problem.title),
        upvotes,
        isPinned: false,
        createdAt: created,
        updatedAt: created,
      });
      shuffle(students.filter((s) => s.id !== author.id))
        .slice(0, upvotes)
        .forEach((voter) =>
          voteRows.push({ id: newId(), postId: topId, userId: voter.id, createdAt: created }),
        );

      for (let r = 0; r < int(0, 3); r++) {
        const replier = pick(students.filter((s) => s.id !== author.id));
        const at = new Date(Math.min(created.getTime() + int(20, 2000) * 60_000, Date.now() - 60_000));
        const replyId = newId();
        const replyVotes = int(0, 4);
        postRows.push({
          id: replyId,
          problemId: problem.id,
          authorId: replier.id,
          parentId: topId,
          content: pick(REPLIES),
          upvotes: replyVotes,
          createdAt: at,
          updatedAt: at,
        });
        shuffle(students.filter((s) => s.id !== replier.id))
          .slice(0, replyVotes)
          .forEach((voter) => voteRows.push({ id: newId(), postId: replyId, userId: voter.id, createdAt: at }));
      }
    }
  }

  // ── AI mentor usage ──────────────────────────────────────────────
  const mentorRows: Prisma.MentorRequestCreateManyInput[] = [];
  for (let i = 0; i < Math.round(STUDENT_COUNT * 2.2); i++) {
    const student = pick(students.filter((s) => s.engagement > 0.2));
    const cached = rand() < 0.15;
    mentorRows.push({
      id: newId(),
      userId: student.id,
      problemId: pick(problems).id,
      language: pickLanguage(student),
      hintLevel: weighted([1, 2, 3], [55, 30, 15]),
      codeHash: randomBytes(32).toString('hex'),
      response: pick(MENTOR_RESPONSES),
      provider: weighted(['ollama', 'anthropic'], [80, 20]),
      cached,
      latencyMs: cached ? int(4, 30) : int(900, 4800),
      createdAt: momentAt(int(0, Math.min(DAYS, student.joinedDaysAgo))),
    });
  }

  // ── Gamification: XP, streaks, badges ────────────────────────────
  const gamificationRows: Prisma.GamificationCreateManyInput[] = [];
  const stats = new Map<string, { xp: number; longest: number; solved: number }>();

  for (const student of students) {
    const days = [...(activeDays.get(student.id) ?? [])].sort((a, b) => a - b);
    let longest = 0;
    let run = 0;
    for (let i = 0; i < days.length; i++) {
      run = i > 0 && days[i] - days[i - 1] === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    const last = days.length > 0 ? days[days.length - 1] : null;
    const today = dayKey(new Date());
    const current = last !== null && today - last <= 1 ? run : 0;
    const solvedCount = solved.get(student.id)?.size ?? 0;
    const xp = Math.round(solvedPoints.get(student.id) ?? 0);

    stats.set(student.id, { xp, longest, solved: solvedCount });
    gamificationRows.push({
      id: newId(),
      userId: student.id,
      xp,
      level: levelForXp(xp),
      currentStreak: current,
      longestStreak: longest,
      lastActiveDate: last !== null ? new Date(last * DAY_MS + 12 * 3_600_000) : null,
      problemsSolved: solvedCount,
    });
  }

  const ranking = [...students].sort((a, b) => (stats.get(b.id)?.xp ?? 0) - (stats.get(a.id)?.xp ?? 0));
  const userBadgeRows: Prisma.UserBadgeCreateManyInput[] = [];
  for (const student of students) {
    const s = stats.get(student.id)!;
    const keys: string[] = [];
    if (s.solved >= 1) keys.push('first_solve');
    if (s.longest >= 7) keys.push('streak_7');
    if (s.longest >= 21) keys.push('streak_21');
    if (s.xp > 0 && ranking.indexOf(student) < 10) keys.push('top_10');
    if (s.solved >= 6 && student.skill > 0.65) keys.push('perfect_score');
    for (const key of keys) {
      if (!badgeByKey[key]) continue;
      userBadgeRows.push({
        id: newId(),
        userId: student.id,
        badgeId: badgeByKey[key],
        earnedAt: momentAt(int(0, Math.min(DAYS, student.joinedDaysAgo))),
      });
    }
  }

  // ── Write everything, parents before children ────────────────────
  console.log('▸ Writing to the database…');
  await insertAll(userRows, (data) => prisma.user.createMany({ data }));

  for (const cls of classes) {
    const roster = enrolment.get(cls.id) ?? [];
    await insertAll(
      roster.map((s) => ({
        id: newId(),
        userId: s.id,
        classId: cls.id,
        joinedAt: momentAt(s.joinedDaysAgo, 10),
      })),
      (data) => prisma.enrollment.createMany({ data }),
    );
  }

  await insertAll(examRows, (data) => prisma.exam.createMany({ data }));
  await insertAll(examProblemRows, (data) => prisma.examProblem.createMany({ data }));
  await insertAll(attemptRows, (data) => prisma.examAttempt.createMany({ data }));
  await insertAll(
    drafts.map((d) => d.row),
    (data) => prisma.submission.createMany({ data }),
  );
  await insertAll(
    drafts.flatMap((d) => d.results),
    (data) => prisma.testResult.createMany({ data }),
  );
  await insertAll(violationRows, (data) => prisma.violation.createMany({ data }));
  await insertAll(
    postRows.filter((p) => !p.parentId),
    (data) => prisma.discussionPost.createMany({ data }),
  );
  await insertAll(
    postRows.filter((p) => p.parentId),
    (data) => prisma.discussionPost.createMany({ data }),
  );
  await insertAll(voteRows, (data) => prisma.discussionVote.createMany({ data }));
  await insertAll(mentorRows, (data) => prisma.mentorRequest.createMany({ data }));
  await insertAll(gamificationRows, (data) => prisma.gamification.createMany({ data }));
  await insertAll(userBadgeRows, (data) => prisma.userBadge.createMany({ data }));

  const passedCount = drafts.filter((d) => d.row.passed).length;
  console.log('\n✔ Demo data added');
  console.table({
    students: students.length,
    submissions: drafts.length,
    'pass rate': `${Math.round((passedCount / Math.max(drafts.length, 1)) * 100)}%`,
    exams: examRows.length,
    'exam attempts': attemptRows.length,
    violations: violationRows.length,
    'discussion posts': postRows.length,
    'mentor requests': mentorRows.length,
    badges: userBadgeRows.length,
  });
  console.log('Remove it any time with: pnpm db:demo:remove\n');
}

main()
  .catch((error) => {
    console.error('✖ Demo data failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
