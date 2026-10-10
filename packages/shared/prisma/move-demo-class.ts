/**
 * Moves ONLY the demo students (username starts with "demo_") out of the real
 * class and into their own class, so analytics can be shown on demo data while
 * the real students stay in CSE2026A untouched.
 *
 * What it does:
 *   - creates the target class (default DEMO2026) under the same teacher, with
 *     the same assigned problems as the source class
 *   - removes every demo student from all other classes and enrols them in the target
 *   - moves the generated demo exams ("[demo]" description) to the target class
 *
 * Real users, their enrollments, submissions and exams are never modified.
 * Safe to run repeatedly. The target class id starts with "demo_", so
 * `db:demo:remove` also cleans it up.
 *
 *   pnpm --filter @simulyn/shared db:demo:move
 *   pnpm --filter @simulyn/shared db:demo:move -- --dry-run
 *
 * Options: --from=CSE2026A  --to=DEMO2026  --name="Demo Analytics Batch"
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const opt = (key: string, fallback: string) =>
  args.find((a) => a.startsWith(`--${key}=`))?.split('=').slice(1).join('=') || fallback;

const DRY = args.includes('--dry-run');
const FROM_CODE = opt('from', 'CSE2026A');
const TO_CODE = opt('to', 'DEMO2026');
const TO_NAME = opt('name', 'Demo Analytics Batch');
const DEMO_USER_PREFIX = 'demo_';
const DEMO_EXAM_MARK = '[demo]';

async function main() {
  const source = await prisma.class.findUnique({ where: { code: FROM_CODE } });
  if (!source) {
    console.error(`✖ No class with code ${FROM_CODE}.`);
    process.exit(1);
  }
  if (TO_CODE === FROM_CODE) {
    console.error('✖ --to and --from must be different classes.');
    process.exit(1);
  }

  const demoUsers = await prisma.user.findMany({
    where: { role: 'STUDENT', username: { startsWith: DEMO_USER_PREFIX } },
    select: { id: true },
  });
  const demoIds = demoUsers.map((u) => u.id);
  if (demoIds.length === 0) {
    console.log('Nothing to do: no demo students found.');
    return;
  }

  let target = await prisma.class.findUnique({ where: { code: TO_CODE } });
  const demoExams = await prisma.exam.findMany({
    where: { description: { startsWith: DEMO_EXAM_MARK }, ...(target ? { classId: { not: target.id } } : {}) },
    select: { id: true },
  });
  const toRemove = await prisma.enrollment.count({
    where: { userId: { in: demoIds }, ...(target ? { classId: { not: target.id } } : {}) },
  });

  console.log(`Demo students: ${demoIds.length}`);
  console.log(`Enrollments to move out of other classes: ${toRemove}`);
  console.log(`Demo exams to move: ${demoExams.length}`);
  console.log(`Target class: ${TO_CODE}${target ? ' (exists)' : ' (will be created)'}`);
  if (DRY) {
    console.log('Dry run: nothing was changed.');
    return;
  }

  if (!target) {
    target = await prisma.class.create({
      data: {
        id: 'demo_class_analytics',
        name: TO_NAME,
        code: TO_CODE,
        description: 'Demo students and generated activity, kept apart from real classes.',
        semester: source.semester,
        teacherId: source.teacherId,
      },
    });
  }
  const targetId = target.id;

  // Same assigned problems as the real class, so problem analytics make sense.
  const have = new Set(
    (await prisma.classProblem.findMany({ where: { classId: targetId }, select: { problemId: true } })).map(
      (r) => r.problemId,
    ),
  );
  const assigned = (
    await prisma.classProblem.findMany({
      where: { classId: source.id },
      select: { problemId: true, dueDate: true },
    })
  ).filter((r) => !have.has(r.problemId));

  const enrolled = new Set(
    (await prisma.enrollment.findMany({ where: { classId: targetId }, select: { userId: true } })).map((e) => e.userId),
  );
  const joinTimes = new Map(
    (
      await prisma.enrollment.findMany({
        where: { userId: { in: demoIds }, classId: source.id },
        select: { userId: true, joinedAt: true },
      })
    ).map((e) => [e.userId, e.joinedAt]),
  );
  const newEnrollments = demoIds
    .filter((id) => !enrolled.has(id))
    .map((userId) => ({ userId, classId: targetId, joinedAt: joinTimes.get(userId) ?? new Date() }));

  await prisma.$transaction([
    prisma.classProblem.createMany({
      data: assigned.map((r) => ({ classId: targetId, problemId: r.problemId, dueDate: r.dueDate })),
    }),
    prisma.enrollment.createMany({ data: newEnrollments }),
    prisma.enrollment.deleteMany({ where: { userId: { in: demoIds }, classId: { not: targetId } } }),
    prisma.exam.updateMany({
      where: { id: { in: demoExams.map((e) => e.id) } },
      data: { classId: targetId },
    }),
  ]);

  const [demoCount, realCount] = await Promise.all([
    prisma.enrollment.count({ where: { classId: targetId } }),
    prisma.enrollment.count({ where: { classId: source.id } }),
  ]);
  console.log(`✔ ${TO_CODE} now has ${demoCount} students; ${FROM_CODE} has ${realCount} (real students only).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
