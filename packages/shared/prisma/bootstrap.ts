/**
 * SIMULYN production bootstrap — NON-destructive and idempotent.
 *
 * Unlike seed.ts this never deletes anything. It only inserts what is missing:
 * badges, an admin, a teacher, the CSE2026A class, the full problem bank, and
 * the class↔problem assignments. Existing users and passwords are never touched.
 *
 * Passwords: BOOTSTRAP_ADMIN_PASSWORD / BOOTSTRAP_TEACHER_PASSWORD. If unset, a
 * random one is generated and printed ONCE, at creation time.
 *
 * Run with: pnpm --filter @simulyn/shared db:bootstrap
 */
import { randomBytes } from 'node:crypto';

import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { BADGE_DEFINITIONS } from '../src/constants/badge-definitions';
import { ELECTRONICS_PROBLEMS } from './seed-data/electronics-problems';
import { PROGRAMMING_PROBLEMS } from './seed-data/programming-problems';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;
const CLASS_CODE = 'CSE2026A';

async function ensureUser(opts: {
  username: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'TEACHER';
  envVar: string;
}) {
  const existing = await prisma.user.findUnique({ where: { username: opts.username } });
  if (existing) return existing;

  const supplied = process.env[opts.envVar]?.trim();
  const password = supplied || randomBytes(9).toString('base64url');
  const user = await prisma.user.create({
    data: {
      username: opts.username,
      email: opts.email,
      displayName: opts.displayName,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: opts.role as Prisma.UserCreateInput['role'],
      mustChangePassword: false,
      isActive: true,
    },
  });
  console.log(
    `[bootstrap] created ${opts.role} "${opts.username}"` +
      (supplied ? ` (password from ${opts.envVar})` : ` — generated password: ${password}`),
  );
  return user;
}

async function main() {
  const admin = await ensureUser({
    username: 'admin',
    email: 'admin@simulyn.edu',
    displayName: 'System Administrator',
    role: 'ADMIN',
    envVar: 'BOOTSTRAP_ADMIN_PASSWORD',
  });
  void admin;
  const teacher = await ensureUser({
    username: 'dr.sunitha',
    email: 'sunitha@simulyn.edu',
    displayName: 'Dr. Sunitha K',
    role: 'TEACHER',
    envVar: 'BOOTSTRAP_TEACHER_PASSWORD',
  });

  for (const badge of BADGE_DEFINITIONS) {
    await prisma.badge.upsert({
      where: { key: badge.key },
      update: {},
      create: {
        key: badge.key,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        condition: JSON.stringify(badge.condition),
      },
    });
  }

  const cls =
    (await prisma.class.findUnique({ where: { code: CLASS_CODE } })) ??
    (await prisma.class.create({
      data: {
        name: 'CSE 2026 Batch A',
        code: CLASS_CODE,
        description: 'Data structures, algorithms and analog electronics lab — 2026 batch.',
        semester: 'Odd 2026',
        teacherId: teacher.id,
      },
    }));

  const problemIds: string[] = [];
  let created = 0;

  for (const p of PROGRAMMING_PROBLEMS) {
    const found = await prisma.problem.findFirst({ where: { title: p.title, type: 'PROGRAMMING' } });
    if (found) {
      await prisma.testCase.deleteMany({ where: { problemId: found.id } });
      await prisma.testCase.createMany({ data: p.testCases.map((tc, i) => ({ problemId: found.id, input: tc.input, expected: tc.expected, isHidden: tc.isHidden ?? false, order: i })) });
      problemIds.push(found.id);
      continue;
    }
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
        hints: { create: p.hints.map((text, i) => ({ level: i + 1, text })) },
      },
    });
    problemIds.push(problem.id);
    created++;
  }

  for (const p of ELECTRONICS_PROBLEMS) {
    const found = await prisma.problem.findFirst({ where: { title: p.title, type: 'ELECTRONICS' } });
    if (found) {
      problemIds.push(found.id);
      continue;
    }
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
        hints: { create: p.hints.map((text, i) => ({ level: i + 1, text })) },
      },
    });
    problemIds.push(problem.id);
    created++;
  }

  for (const problemId of problemIds) {
    await prisma.classProblem.upsert({
      where: { classId_problemId: { classId: cls.id, problemId } },
      update: {},
      create: { classId: cls.id, problemId },
    });
  }

  console.log(
    `[bootstrap] ok — ${created} problems added, ${problemIds.length} total in class ${CLASS_CODE}`,
  );
}

main()
  .catch((e) => {
    console.error('[bootstrap] FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
