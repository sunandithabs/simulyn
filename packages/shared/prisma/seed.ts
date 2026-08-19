/**
 * SIMULYN demo seed.
 *
 * Wipes and repopulates the database with a complete, self-consistent demo:
 * accounts for every role, one class, the problem bank, badges and
 * gamification state.
 *
 * Run with: pnpm db:seed   (from the repo root, or inside packages/shared)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { BADGE_DEFINITIONS, LEVEL_THRESHOLDS } from '../src/constants/badge-definitions';
import { PROGRAMMING_PROBLEMS } from './seed-data/programming-problems';
import { ELECTRONICS_PROBLEMS } from './seed-data/electronics-problems';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Child-first deletion order — SQLite enforces the foreign keys. */
async function reset() {
  await prisma.testResult.deleteMany();
  await prisma.violation.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.examProblem.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.discussionPost.deleteMany();
  await prisma.mentorRequest.deleteMany();
  await prisma.classProblem.deleteMany();
  await prisma.hint.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.gamification.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.class.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

interface SeedAccount {
  username: string;
  password: string;
  email: string;
  displayName: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  mustChangePassword: boolean;
}

const ACCOUNTS: SeedAccount[] = [
  {
    username: 'admin',
    password: 'admin123',
    email: 'admin@simulyn.edu',
    displayName: 'System Administrator',
    role: 'ADMIN',
    mustChangePassword: false,
  },
  {
    username: 'dr.sunitha',
    password: 'teacher1',
    email: 'sunitha@simulyn.edu',
    displayName: 'Dr. Sunitha K',
    role: 'TEACHER',
    mustChangePassword: false,
  },
  {
    username: 'sunan',
    password: 'student1',
    email: 'sunan@simulyn.edu',
    displayName: 'Sunan R',
    role: 'STUDENT',
    mustChangePassword: false,
  },
  {
    username: 'vivek',
    password: 'student2',
    email: 'vivek@simulyn.edu',
    displayName: 'Vivek M',
    role: 'STUDENT',
    mustChangePassword: false,
  },
  {
    username: 'vahini',
    password: 'student3',
    email: 'vahini@simulyn.edu',
    displayName: 'Vahini S',
    role: 'STUDENT',
    mustChangePassword: false,
  },
  {
    username: 'sanjan',
    password: 'student4',
    email: 'sanjan@simulyn.edu',
    displayName: 'Sanjan P',
    role: 'STUDENT',
    mustChangePassword: false,
  },
];

/** Demo progress per student username. */
const GAMIFICATION_SEED: Record<
  string,
  { xp: number; currentStreak: number; longestStreak: number; problemsSolved: number; lastActiveDaysAgo: number }
> = {
  sunan: { xp: 3200, currentStreak: 12, longestStreak: 21, problemsSolved: 9, lastActiveDaysAgo: 0 },
  vivek: { xp: 1450, currentStreak: 4, longestStreak: 9, problemsSolved: 5, lastActiveDaysAgo: 1 },
  vahini: { xp: 6200, currentStreak: 21, longestStreak: 24, problemsSolved: 13, lastActiveDaysAgo: 0 },
  sanjan: { xp: 620, currentStreak: 1, longestStreak: 3, problemsSolved: 2, lastActiveDaysAgo: 2 },
};

async function main() {
  console.log('▸ Resetting database…');
  await reset();

  // ── Users ──────────────────────────────────────────────────────────
  console.log('▸ Creating users…');
  const users: Record<string, { id: string; role: string }> = {};

  for (const account of ACCOUNTS) {
    const user = await prisma.user.create({
      data: {
        username: account.username,
        email: account.email,
        displayName: account.displayName,
        passwordHash: await bcrypt.hash(account.password, BCRYPT_ROUNDS),
        role: account.role as Prisma.UserCreateInput['role'],
        mustChangePassword: account.mustChangePassword,
        isActive: true,
      },
    });
    users[account.username] = { id: user.id, role: user.role };
  }

  const teacher = users['dr.sunitha'];
  const studentUsernames = ACCOUNTS.filter((a) => a.role === 'STUDENT').map((a) => a.username);

  // ── Class & enrollment ─────────────────────────────────────────────
  console.log('▸ Creating class CSE2026A…');
  const cls = await prisma.class.create({
    data: {
      name: 'CSE 2026 Batch A',
      code: 'CSE2026A',
      description: 'Data structures, algorithms and analog electronics lab — 2026 batch.',
      semester: 'Odd 2026',
      teacherId: teacher.id,
    },
  });

  for (const username of studentUsernames) {
    await prisma.enrollment.create({
      data: { userId: users[username].id, classId: cls.id },
    });
  }

  // ── Badges ─────────────────────────────────────────────────────────
  console.log('▸ Creating badges…');
  for (const badge of BADGE_DEFINITIONS) {
    await prisma.badge.create({
      data: {
        key: badge.key,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        condition: JSON.stringify(badge.condition),
      },
    });
  }

  // ── Programming problems ───────────────────────────────────────────
  console.log(`▸ Creating ${PROGRAMMING_PROBLEMS.length} programming problems…`);
  const problemIds: string[] = [];

  for (const p of PROGRAMMING_PROBLEMS) {
    const problem = await prisma.problem.create({
      data: {
        type: 'PROGRAMMING',
        difficulty: p.difficulty as Prisma.ProblemCreateInput['difficulty'],
        category: p.category,
        title: p.title,
        description: p.description,
        constraints: JSON.stringify(p.constraints),
        points: p.points,
        tags: JSON.stringify(p.tags),
        isPublished: true,
        createdById: teacher.id,
        starterCode: JSON.stringify(p.starterCode),
        harness: JSON.stringify(p.harness),
        examples: JSON.stringify(p.examples),
        testCases: {
          create: p.testCases.map((tc, i) => ({
            input: tc.input,
            expected: tc.expected,
            isHidden: tc.isHidden ?? false,
            order: i,
          })),
        },
        hints: {
          create: p.hints.map((text, i) => ({ level: i + 1, text })),
        },
      },
    });
    problemIds.push(problem.id);
  }

  // ── Electronics problems ───────────────────────────────────────────
  console.log(`▸ Creating ${ELECTRONICS_PROBLEMS.length} electronics problems…`);
  for (const p of ELECTRONICS_PROBLEMS) {
    const problem = await prisma.problem.create({
      data: {
        type: 'ELECTRONICS',
        difficulty: p.difficulty as Prisma.ProblemCreateInput['difficulty'],
        category: p.category,
        title: p.title,
        description: p.description,
        constraints: JSON.stringify(p.constraints),
        points: p.points,
        tags: JSON.stringify(p.tags),
        isPublished: true,
        createdById: teacher.id,
        params: JSON.stringify(p.params),
        questions: JSON.stringify(p.questions),
        hints: {
          create: p.hints.map((text, i) => ({ level: i + 1, text })),
        },
      },
    });
    problemIds.push(problem.id);
  }

  // ── Assign the whole bank to the demo class ────────────────────────
  console.log('▸ Assigning problems to CSE2026A…');
  for (const problemId of problemIds) {
    await prisma.classProblem.create({
      data: { classId: cls.id, problemId },
    });
  }

  // ── Gamification + earned badges ───────────────────────────────────
  console.log('▸ Creating gamification records…');
  const badgeByKey = Object.fromEntries(
    (await prisma.badge.findMany()).map((b) => [b.key, b.id]),
  );

  const ranked = studentUsernames
    .slice()
    .sort((a, b) => GAMIFICATION_SEED[b].xp - GAMIFICATION_SEED[a].xp);

  for (const username of studentUsernames) {
    const stats = GAMIFICATION_SEED[username];
    const userId = users[username].id;

    await prisma.gamification.create({
      data: {
        userId,
        xp: stats.xp,
        level: levelForXp(stats.xp),
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        problemsSolved: stats.problemsSolved,
        lastActiveDate: daysAgo(stats.lastActiveDaysAgo),
      },
    });

    const earned: string[] = [];
    if (stats.problemsSolved >= 1) earned.push('first_solve');
    if (stats.longestStreak >= 7) earned.push('streak_7');
    if (stats.longestStreak >= 21) earned.push('streak_21');
    if (ranked.indexOf(username) < 10) earned.push('top_10');
    if (stats.problemsSolved >= 10) earned.push('perfect_score');

    for (const key of earned) {
      await prisma.userBadge.create({
        data: { userId, badgeId: badgeByKey[key], earnedAt: daysAgo(stats.lastActiveDaysAgo + 3) },
      });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    classes: await prisma.class.count(),
    enrollments: await prisma.enrollment.count(),
    problems: await prisma.problem.count(),
    testCases: await prisma.testCase.count(),
    hints: await prisma.hint.count(),
    badges: await prisma.badge.count(),
    userBadges: await prisma.userBadge.count(),
    gamification: await prisma.gamification.count(),
    classProblems: await prisma.classProblem.count(),
  };

  console.log('\n✔ Seed complete');
  console.table(counts);
  console.log('\nDemo accounts:');
  for (const a of ACCOUNTS) {
    console.log(`  ${a.role.padEnd(7)}  ${a.username.padEnd(11)}  ${a.password}`);
  }
  console.log('\nClass join code: CSE2026A\n');
}

main()
  .catch((e) => {
    console.error('✖ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
