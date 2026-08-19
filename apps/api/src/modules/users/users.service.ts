import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@simulyn/shared';
import bcrypt from 'bcryptjs';

import { BCRYPT_ROUNDS } from '../../common/constants';
import { orderByFrom, paginated, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkCreateResultDto, BulkCreateUsersDto } from './dto/bulk-create-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** Never expose passwordHash. */
export const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  avatar: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

const SORTABLE = ['createdAt', 'username', 'displayName', 'email', 'lastLoginAt', 'role'] as const;

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
  lastActiveDate: Date | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── access helpers ─────────────────────────────────────────────────

  private assertSelfOrAdmin(requester: AuthenticatedUser, targetId: string): void {
    if (requester.role !== Role.ADMIN && requester.id !== targetId) {
      throw new ForbiddenException('You may only access your own account');
    }
  }

  // ── queries ────────────────────────────────────────────────────────

  async findAll(query: QueryUsersDto): Promise<PaginatedResult<PublicUser>> {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (typeof query.isActive === 'boolean') where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { username: { contains: query.search } },
        { displayName: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: orderByFrom(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginated(data, total, query);
  }

  /**
   * Narrow student search so a teacher can enroll people who already have an
   * account. Deliberately limited: students only, active only, a handful of
   * fields, and a minimum query length so it cannot be used to enumerate.
   */
  async lookupStudents(term: string) {
    const query = term.trim();
    if (query.length < 2) return [];

    return this.prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        isActive: true,
        OR: [
          { username: { contains: query } },
          { displayName: { contains: query } },
          { email: { contains: query } },
        ],
      },
      select: { id: true, username: true, displayName: true, avatar: true, email: true },
      orderBy: { username: 'asc' },
      take: 20,
    });
  }

  async findOne(id: string, requester: AuthenticatedUser): Promise<PublicUser> {
    this.assertSelfOrAdmin(requester, id);
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  // ── mutations ──────────────────────────────────────────────────────

  async create(dto: CreateUserDto): Promise<PublicUser> {
    await this.assertUnique(dto.username, dto.email);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email.toLowerCase(),
        displayName: dto.displayName,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: dto.role ?? Role.STUDENT,
        avatar: dto.avatar,
        mustChangePassword: dto.mustChangePassword ?? true,
      },
      select: USER_SELECT,
    });

    // Students get a gamification row immediately so leaderboards are complete.
    if (user.role === Role.STUDENT) {
      await this.prisma.gamification.create({ data: { userId: user.id } });
    }

    this.logger.log(`Created ${user.role} account ${user.username}`);
    return user;
  }

  async bulkCreate(dto: BulkCreateUsersDto, requester: AuthenticatedUser): Promise<BulkCreateResultDto> {
    const role = dto.role ?? Role.STUDENT;

    if (role !== Role.STUDENT && requester.role !== Role.ADMIN) {
      throw new ForbiddenException('Only an admin may bulk-create non-student accounts');
    }

    if (dto.classId) {
      const cls = await this.prisma.class.findUnique({ where: { id: dto.classId } });
      if (!cls) throw new NotFoundException(`Class ${dto.classId} not found`);
      if (requester.role !== Role.ADMIN && cls.teacherId !== requester.id) {
        throw new ForbiddenException('You do not teach that class');
      }
    }

    const result: BulkCreateResultDto = {
      created: 0,
      failed: 0,
      createdUsernames: [],
      failures: [],
    };

    for (const row of dto.users) {
      try {
        const user = await this.prisma.user.create({
          data: {
            username: row.username,
            email: row.email.toLowerCase(),
            displayName: row.displayName,
            passwordHash: await bcrypt.hash(row.password, BCRYPT_ROUNDS),
            role,
            mustChangePassword: true,
          },
        });

        if (role === Role.STUDENT) {
          await this.prisma.gamification.create({ data: { userId: user.id } });
        }
        if (dto.classId) {
          await this.prisma.enrollment.create({
            data: { userId: user.id, classId: dto.classId },
          });
        }

        result.created += 1;
        result.createdUsernames.push(user.username);
      } catch (error) {
        result.failed += 1;
        result.failures.push({ username: row.username, reason: this.describeError(error) });
      }
    }

    this.logger.log(`Bulk import by ${requester.username}: ${result.created} created, ${result.failed} failed`);
    return result;
  }

  async update(id: string, dto: UpdateUserDto, requester: AuthenticatedUser): Promise<PublicUser> {
    this.assertSelfOrAdmin(requester, id);

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User ${id} not found`);

    const isAdmin = requester.role === Role.ADMIN;
    if (!isAdmin) {
      const privileged = ['role', 'isActive', 'password', 'mustChangePassword'] as const;
      const attempted = privileged.filter((field) => dto[field] !== undefined);
      if (attempted.length > 0) {
        throw new ForbiddenException(`Only an admin may change: ${attempted.join(', ')}`);
      }
    }

    if (dto.email && dto.email.toLowerCase() !== existing.email) {
      await this.assertUnique(undefined, dto.email);
    }

    // An admin must not lock themselves out of the last admin account.
    if (isAdmin && existing.role === Role.ADMIN && (dto.isActive === false || (dto.role && dto.role !== Role.ADMIN))) {
      const admins = await this.prisma.user.count({ where: { role: Role.ADMIN, isActive: true } });
      if (admins <= 1) throw new BadRequestException('The last active admin account cannot be demoted or disabled');
    }

    const data: Prisma.UserUpdateInput = {
      displayName: dto.displayName,
      email: dto.email?.toLowerCase(),
      avatar: dto.avatar,
      role: isAdmin ? dto.role : undefined,
      isActive: isAdmin ? dto.isActive : undefined,
      mustChangePassword: isAdmin ? dto.mustChangePassword : undefined,
    };

    if (isAdmin && dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      // A reset password must be changed on next sign-in unless told otherwise.
      data.mustChangePassword = dto.mustChangePassword ?? true;
      await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    }

    // Promoting to student without a gamification row would break leaderboards.
    if (isAdmin && dto.role === Role.STUDENT) {
      await this.prisma.gamification.upsert({
        where: { userId: id },
        create: { userId: id },
        update: {},
      });
    }

    return this.prisma.user.update({ where: { id }, data, select: USER_SELECT });
  }

  /** Soft delete — the account is deactivated, never removed. */
  async deactivate(id: string, requester: AuthenticatedUser): Promise<PublicUser> {
    if (id === requester.id) throw new BadRequestException('You cannot deactivate your own account');

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User ${id} not found`);

    if (existing.role === Role.ADMIN) {
      const admins = await this.prisma.user.count({ where: { role: Role.ADMIN, isActive: true } });
      if (admins <= 1) throw new BadRequestException('The last active admin account cannot be deactivated');
    }

    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    this.logger.log(`${requester.username} deactivated ${existing.username}`);

    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: USER_SELECT,
    });
  }

  // ── stats ──────────────────────────────────────────────────────────

  async stats(id: string, requester: AuthenticatedUser): Promise<UserStats> {
    // Teachers may read the stats of anyone they teach; admins read anyone.
    if (requester.role === Role.STUDENT) {
      this.assertSelfOrAdmin(requester, id);
    } else if (requester.role === Role.TEACHER && requester.id !== id) {
      const shared = await this.prisma.enrollment.count({
        where: { userId: id, class: { teacherId: requester.id } },
      });
      if (shared === 0) throw new ForbiddenException('That student is not in any of your classes');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, displayName: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const [gamification, totalSubmissions, passedSubmissions, solvedGroups] = await Promise.all([
      this.prisma.gamification.findUnique({ where: { userId: id } }),
      this.prisma.submission.count({ where: { userId: id } }),
      this.prisma.submission.count({ where: { userId: id, passed: true } }),
      this.prisma.submission.groupBy({
        by: ['problemId'],
        where: { userId: id, passed: true },
      }),
    ]);

    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      problemsSolved: solvedGroups.length,
      totalSubmissions,
      passedSubmissions,
      accuracy: totalSubmissions === 0 ? 0 : Math.round((passedSubmissions / totalSubmissions) * 100),
      xp: gamification?.xp ?? 0,
      level: gamification?.level ?? 1,
      currentStreak: gamification?.currentStreak ?? 0,
      longestStreak: gamification?.longestStreak ?? 0,
      lastActiveDate: gamification?.lastActiveDate ?? null,
    };
  }

  // ── internals ──────────────────────────────────────────────────────

  private async assertUnique(username?: string, email?: string): Promise<void> {
    const or: Prisma.UserWhereInput[] = [];
    if (username) or.push({ username });
    if (email) or.push({ email: email.toLowerCase() });
    if (or.length === 0) return;

    const clash = await this.prisma.user.findFirst({ where: { OR: or } });
    if (!clash) return;

    if (username && clash.username === username) {
      throw new BadRequestException(`Username "${username}" is already taken`);
    }
    throw new BadRequestException(`Email "${email}" is already registered`);
  }

  private describeError(error: unknown): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = error.meta?.target;
      const field = Array.isArray(target) ? target.join(', ') : String(target ?? 'field');
      return `duplicate ${field}`;
    }
    return error instanceof Error ? error.message : 'unknown error';
  }
}
