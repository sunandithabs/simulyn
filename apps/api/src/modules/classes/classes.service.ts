import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@simulyn/shared';
import { randomInt } from 'node:crypto';

import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from '../../common/constants';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { EnrollStudentsDto } from './dto/enroll-students.dto';
import { UpdateClassDto } from './dto/update-class.dto';

const CLASS_SELECT = {
  id: true,
  name: true,
  code: true,
  description: true,
  semester: true,
  teacherId: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  teacher: { select: { id: true, username: true, displayName: true, avatar: true } },
  _count: { select: { enrollments: true, assignedProblems: true, exams: true } },
} satisfies Prisma.ClassSelect;

export type ClassWithCounts = Prisma.ClassGetPayload<{ select: typeof CLASS_SELECT }>;

export interface ClassStudentProgress {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  joinedAt: Date;
  problemsSolved: number;
  assignedProblems: number;
  totalSubmissions: number;
  passedSubmissions: number;
  accuracy: number;
  xp: number;
  level: number;
  currentStreak: number;
}

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── access control ─────────────────────────────────────────────────

  /** Owner-teacher or admin. Used for every mutating operation. */
  private async assertManages(classId: string, requester: AuthenticatedUser) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException(`Class ${classId} not found`);
    if (requester.role !== Role.ADMIN && cls.teacherId !== requester.id) {
      throw new ForbiddenException('You do not teach this class');
    }
    return cls;
  }

  /** Owner-teacher, admin, or an enrolled student. */
  private async assertCanRead(classId: string, requester: AuthenticatedUser) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException(`Class ${classId} not found`);

    if (requester.role === Role.ADMIN || cls.teacherId === requester.id) return cls;

    const enrolled = await this.prisma.enrollment.count({
      where: { classId, userId: requester.id },
    });
    if (enrolled === 0) throw new ForbiddenException('You are not enrolled in this class');
    return cls;
  }

  // ── join codes ─────────────────────────────────────────────────────

  private randomCode(): string {
    let code = '';
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
      code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
    }
    return code;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = this.randomCode();
      const taken = await this.prisma.class.count({ where: { code } });
      if (taken === 0) return code;
    }
    throw new BadRequestException('Could not allocate a unique join code — please retry');
  }

  // ── CRUD ───────────────────────────────────────────────────────────

  async create(dto: CreateClassDto, requester: AuthenticatedUser): Promise<ClassWithCounts> {
    let teacherId = requester.id;

    if (dto.teacherId && dto.teacherId !== requester.id) {
      if (requester.role !== Role.ADMIN) {
        throw new ForbiddenException('Only an admin may create a class on behalf of another teacher');
      }
      const teacher = await this.prisma.user.findUnique({ where: { id: dto.teacherId } });
      if (!teacher) throw new NotFoundException(`Teacher ${dto.teacherId} not found`);
      if (teacher.role === Role.STUDENT) {
        throw new BadRequestException('Classes must be owned by a teacher or admin account');
      }
      teacherId = teacher.id;
    }

    const cls = await this.prisma.class.create({
      data: {
        name: dto.name,
        description: dto.description,
        semester: dto.semester,
        code: await this.generateUniqueCode(),
        teacherId,
      },
      select: CLASS_SELECT,
    });

    this.logger.log(`${requester.username} created class ${cls.name} (${cls.code})`);
    return cls;
  }

  /** Teachers see the classes they own, students the ones they joined, admins everything. */
  async findAll(requester: AuthenticatedUser, includeArchived = false): Promise<ClassWithCounts[]> {
    const where: Prisma.ClassWhereInput = includeArchived ? {} : { isArchived: false };

    if (requester.role === Role.TEACHER) {
      where.teacherId = requester.id;
    } else if (requester.role === Role.STUDENT) {
      where.enrollments = { some: { userId: requester.id } };
    }

    return this.prisma.class.findMany({
      where,
      select: CLASS_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, requester: AuthenticatedUser): Promise<ClassWithCounts> {
    await this.assertCanRead(id, requester);
    const cls = await this.prisma.class.findUnique({ where: { id }, select: CLASS_SELECT });
    if (!cls) throw new NotFoundException(`Class ${id} not found`);
    return cls;
  }

  async update(id: string, dto: UpdateClassDto, requester: AuthenticatedUser): Promise<ClassWithCounts> {
    await this.assertManages(id, requester);
    return this.prisma.class.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        semester: dto.semester,
        isArchived: dto.isArchived,
      },
      select: CLASS_SELECT,
    });
  }

  // ── enrollment ─────────────────────────────────────────────────────

  async enroll(
    classId: string,
    dto: EnrollStudentsDto,
    requester: AuthenticatedUser,
  ): Promise<{ enrolled: number; skipped: number; notFound: string[] }> {
    await this.assertManages(classId, requester);

    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.userIds }, isActive: true },
      select: { id: true },
    });
    const found = new Set(users.map((u) => u.id));
    const notFound = dto.userIds.filter((id) => !found.has(id));

    const existing = await this.prisma.enrollment.findMany({
      where: { classId, userId: { in: [...found] } },
      select: { userId: true },
    });
    const already = new Set(existing.map((e) => e.userId));
    const toCreate = [...found].filter((id) => !already.has(id));

    if (toCreate.length > 0) {
      await this.prisma.enrollment.createMany({
        data: toCreate.map((userId) => ({ classId, userId })),
      });
    }

    return { enrolled: toCreate.length, skipped: already.size, notFound };
  }

  /** Student self-enrolls with the class join code. */
  async join(code: string, requester: AuthenticatedUser): Promise<ClassWithCounts> {
    const cls = await this.prisma.class.findUnique({ where: { code: code.toUpperCase() } });
    if (!cls) throw new NotFoundException('No class matches that code');
    if (cls.isArchived) throw new BadRequestException('That class has been archived');
    if (cls.teacherId === requester.id) {
      throw new BadRequestException('You already teach this class');
    }

    const existing = await this.prisma.enrollment.count({
      where: { classId: cls.id, userId: requester.id },
    });
    if (existing > 0) throw new BadRequestException('You are already enrolled in this class');

    await this.prisma.enrollment.create({ data: { classId: cls.id, userId: requester.id } });
    this.logger.log(`${requester.username} joined ${cls.name}`);

    return this.prisma.class.findUniqueOrThrow({ where: { id: cls.id }, select: CLASS_SELECT });
  }

  async removeStudent(
    classId: string,
    userId: string,
    requester: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.assertManages(classId, requester);

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_classId: { userId, classId } },
    });
    if (!enrollment) throw new NotFoundException('That student is not enrolled in this class');

    await this.prisma.enrollment.delete({ where: { id: enrollment.id } });
    return { success: true };
  }

  // ── roster with progress ───────────────────────────────────────────

  async students(classId: string, requester: AuthenticatedUser): Promise<ClassStudentProgress[]> {
    await this.assertCanRead(classId, requester);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            gamification: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const userIds = enrollments.map((e) => e.userId);
    const assigned = await this.prisma.classProblem.findMany({
      where: { classId },
      select: { problemId: true },
    });
    const assignedIds = assigned.map((a) => a.problemId);

    if (userIds.length === 0) return [];

    const [solvedRows, totalRows, passedRows] = await Promise.all([
      assignedIds.length === 0
        ? Promise.resolve([] as { userId: string; problemId: string }[])
        : this.prisma.submission.groupBy({
            by: ['userId', 'problemId'],
            where: { userId: { in: userIds }, problemId: { in: assignedIds }, passed: true },
          }),
      this.prisma.submission.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      this.prisma.submission.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, passed: true },
        _count: { _all: true },
      }),
    ]);

    const solvedByUser = new Map<string, number>();
    for (const row of solvedRows) {
      solvedByUser.set(row.userId, (solvedByUser.get(row.userId) ?? 0) + 1);
    }
    const totalByUser = new Map(totalRows.map((r) => [r.userId, r._count._all]));
    const passedByUser = new Map(passedRows.map((r) => [r.userId, r._count._all]));

    return enrollments.map((e) => {
      const total = totalByUser.get(e.userId) ?? 0;
      const passed = passedByUser.get(e.userId) ?? 0;
      return {
        userId: e.userId,
        username: e.user.username,
        displayName: e.user.displayName,
        avatar: e.user.avatar,
        joinedAt: e.joinedAt,
        problemsSolved: solvedByUser.get(e.userId) ?? 0,
        assignedProblems: assignedIds.length,
        totalSubmissions: total,
        passedSubmissions: passed,
        accuracy: total === 0 ? 0 : Math.round((passed / total) * 100),
        xp: e.user.gamification?.xp ?? 0,
        level: e.user.gamification?.level ?? 1,
        currentStreak: e.user.gamification?.currentStreak ?? 0,
      };
    });
  }
}
