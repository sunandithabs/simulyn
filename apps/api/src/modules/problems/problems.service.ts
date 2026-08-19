import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  parseJson,
  parseJsonOrNull,
  parseStringList,
  Prisma,
  ProblemType,
  Role,
  type Problem,
  type TestCase,
  type Hint,
} from '@simulyn/shared';

import { orderByFrom, paginated, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignProblemDto } from './dto/assign-problem.dto';
import { CreateProblemDto } from './dto/create-problem.dto';
import { QueryProblemsDto } from './dto/query-problems.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';

const SORTABLE = ['createdAt', 'title', 'difficulty', 'points', 'category'] as const;

type ProblemWithRelations = Problem & { testCases?: TestCase[]; hints?: Hint[] };

/** API shape — JSON string columns are parsed back into real objects. */
export interface ProblemView {
  id: string;
  type: ProblemType;
  difficulty: Problem['difficulty'];
  category: string;
  title: string;
  description: string;
  constraints: string[];
  points: number;
  tags: string[];
  isPublished: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  starterCode: Record<string, string> | null;
  harness: unknown;
  examples: unknown[] | null;
  params: Record<string, unknown> | null;
  questions: unknown[] | null;
  testCases?: { id: string; input: string; expected: string; isHidden: boolean; order: number }[];
  hints?: { id: string; level: number; text: string }[];
}

@Injectable()
export class ProblemsService {
  private readonly logger = new Logger(ProblemsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── serialisation ──────────────────────────────────────────────────

  /**
   * @param forStudent strips hidden test cases and the electronics answer keys.
   */
  serialize(problem: ProblemWithRelations, forStudent: boolean): ProblemView {
    const questions = parseJsonOrNull<Record<string, unknown>[]>(problem.questions);

    const view: ProblemView = {
      id: problem.id,
      type: problem.type,
      difficulty: problem.difficulty,
      category: problem.category,
      title: problem.title,
      description: problem.description,
      constraints: parseStringList(problem.constraints),
      points: problem.points,
      tags: parseStringList(problem.tags),
      isPublished: problem.isPublished,
      createdById: problem.createdById,
      createdAt: problem.createdAt,
      updatedAt: problem.updatedAt,
      starterCode: parseJsonOrNull<Record<string, string>>(problem.starterCode),
      harness: parseJsonOrNull<unknown>(problem.harness),
      examples: parseJsonOrNull<unknown[]>(problem.examples),
      params: parseJsonOrNull<Record<string, unknown>>(problem.params),
      // Students must never receive the expected answers.
      questions: forStudent
        ? (questions ?? []).map(({ answer: _answer, ...rest }) => rest)
        : questions,
    };

    if (problem.testCases) {
      const cases = forStudent ? problem.testCases.filter((tc) => !tc.isHidden) : problem.testCases;
      view.testCases = cases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expected: tc.expected,
        isHidden: tc.isHidden,
        order: tc.order,
      }));
    }

    if (problem.hints) {
      view.hints = problem.hints.map((h) => ({ id: h.id, level: h.level, text: h.text }));
    }

    return view;
  }

  // ── validation ─────────────────────────────────────────────────────

  private assertPublishable(dto: CreateProblemDto | UpdateProblemDto, merged: {
    type: ProblemType;
    hasHarness: boolean;
    testCaseCount: number;
    questionCount: number;
  }): void {
    if (!dto.isPublished) return;

    if (merged.type === ProblemType.PROGRAMMING) {
      if (!merged.hasHarness) {
        throw new BadRequestException('A published programming problem needs a harness definition');
      }
      if (merged.testCaseCount === 0) {
        throw new BadRequestException('A published programming problem needs at least one test case');
      }
    } else if (merged.questionCount === 0) {
      throw new BadRequestException('A published electronics problem needs at least one question');
    }
  }

  private assertCanEdit(problem: Problem, requester: AuthenticatedUser): void {
    if (requester.role === Role.ADMIN) return;
    if (problem.createdById !== requester.id) {
      throw new ForbiddenException('Only the author or an admin may modify this problem');
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────

  async create(dto: CreateProblemDto, requester: AuthenticatedUser): Promise<ProblemView> {
    this.assertPublishable(dto, {
      type: dto.type,
      hasHarness: Boolean(dto.harness),
      testCaseCount: dto.testCases?.length ?? 0,
      questionCount: dto.questions?.length ?? 0,
    });

    const levels = new Set((dto.hints ?? []).map((h) => h.level));
    if (levels.size !== (dto.hints?.length ?? 0)) {
      throw new BadRequestException('Hint levels must be unique');
    }

    const problem = await this.prisma.problem.create({
      data: {
        type: dto.type,
        difficulty: dto.difficulty,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        constraints: JSON.stringify(dto.constraints ?? []),
        points: dto.points ?? 100,
        tags: JSON.stringify(dto.tags ?? []),
        isPublished: dto.isPublished ?? false,
        createdById: requester.id,
        starterCode: dto.starterCode ? JSON.stringify(dto.starterCode) : null,
        harness: dto.harness ? JSON.stringify(dto.harness) : null,
        examples: dto.examples ? JSON.stringify(dto.examples) : null,
        params: dto.params ? JSON.stringify(dto.params) : null,
        questions: dto.questions ? JSON.stringify(dto.questions) : null,
        testCases: dto.testCases
          ? {
              create: dto.testCases.map((tc, i) => ({
                input: tc.input,
                expected: tc.expected,
                isHidden: tc.isHidden ?? false,
                order: tc.order ?? i,
              })),
            }
          : undefined,
        hints: dto.hints
          ? { create: dto.hints.map((h) => ({ level: h.level, text: h.text })) }
          : undefined,
      },
      include: { testCases: { orderBy: { order: 'asc' } }, hints: { orderBy: { level: 'asc' } } },
    });

    this.logger.log(`${requester.username} created problem "${problem.title}"`);
    return this.serialize(problem, false);
  }

  async findAll(query: QueryProblemsDto, requester: AuthenticatedUser): Promise<PaginatedResult<ProblemView>> {
    const isStudent = requester.role === Role.STUDENT;

    const where: Prisma.ProblemWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.category) where.category = query.category;
    if (query.search) where.title = { contains: query.search };

    // Students only ever see published problems.
    if (isStudent) where.isPublished = true;
    else if (typeof query.isPublished === 'boolean') where.isPublished = query.isPublished;

    // tags is a JSON string column — match the quoted tag inside it.
    if (query.tags?.length) {
      where.AND = query.tags.map((tag) => ({ tags: { contains: `"${tag}"` } }));
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.problem.findMany({
        where,
        orderBy: orderByFrom(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.problem.count({ where }),
    ]);

    return paginated(rows.map((p) => this.serialize(p, isStudent)), total, query);
  }

  async findOne(id: string, requester: AuthenticatedUser): Promise<ProblemView> {
    const isStudent = requester.role === Role.STUDENT;

    const problem = await this.prisma.problem.findUnique({
      where: { id },
      include: { testCases: { orderBy: { order: 'asc' } }, hints: { orderBy: { level: 'asc' } } },
    });
    if (!problem) throw new NotFoundException(`Problem ${id} not found`);
    if (isStudent && !problem.isPublished) {
      throw new NotFoundException(`Problem ${id} not found`);
    }

    return this.serialize(problem, isStudent);
  }

  async update(id: string, dto: UpdateProblemDto, requester: AuthenticatedUser): Promise<ProblemView> {
    const existing = await this.prisma.problem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Problem ${id} not found`);
    this.assertCanEdit(existing, requester);

    const existingTestCases = await this.prisma.testCase.count({ where: { problemId: id } });
    const existingQuestions = parseJson<unknown[]>(existing.questions, []);

    this.assertPublishable(dto, {
      type: dto.type ?? existing.type,
      hasHarness: dto.harness ? true : Boolean(existing.harness),
      testCaseCount: dto.testCases ? dto.testCases.length : existingTestCases,
      questionCount: dto.questions ? dto.questions.length : existingQuestions.length,
    });

    const data: Prisma.ProblemUpdateInput = {
      type: dto.type,
      difficulty: dto.difficulty,
      category: dto.category,
      title: dto.title,
      description: dto.description,
      points: dto.points,
      isPublished: dto.isPublished,
      constraints: dto.constraints ? JSON.stringify(dto.constraints) : undefined,
      tags: dto.tags ? JSON.stringify(dto.tags) : undefined,
      starterCode: dto.starterCode ? JSON.stringify(dto.starterCode) : undefined,
      harness: dto.harness ? JSON.stringify(dto.harness) : undefined,
      examples: dto.examples ? JSON.stringify(dto.examples) : undefined,
      params: dto.params ? JSON.stringify(dto.params) : undefined,
      questions: dto.questions ? JSON.stringify(dto.questions) : undefined,
    };

    // Supplying a collection replaces it wholesale.
    if (dto.testCases) {
      await this.prisma.testCase.deleteMany({ where: { problemId: id } });
      data.testCases = {
        create: dto.testCases.map((tc, i) => ({
          input: tc.input,
          expected: tc.expected,
          isHidden: tc.isHidden ?? false,
          order: tc.order ?? i,
        })),
      };
    }
    if (dto.hints) {
      await this.prisma.hint.deleteMany({ where: { problemId: id } });
      data.hints = { create: dto.hints.map((h) => ({ level: h.level, text: h.text })) };
    }

    const problem = await this.prisma.problem.update({
      where: { id },
      data,
      include: { testCases: { orderBy: { order: 'asc' } }, hints: { orderBy: { level: 'asc' } } },
    });

    return this.serialize(problem, false);
  }

  async remove(id: string, requester: AuthenticatedUser): Promise<{ success: boolean }> {
    const existing = await this.prisma.problem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Problem ${id} not found`);
    this.assertCanEdit(existing, requester);

    const submissions = await this.prisma.submission.count({ where: { problemId: id } });
    if (submissions > 0) {
      throw new BadRequestException(
        `This problem has ${submissions} submission(s) and cannot be deleted — unpublish it instead`,
      );
    }

    await this.prisma.problem.delete({ where: { id } });
    this.logger.log(`${requester.username} deleted problem "${existing.title}"`);
    return { success: true };
  }

  // ── class assignment ───────────────────────────────────────────────

  private async assertManagesClass(classId: string, requester: AuthenticatedUser) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException(`Class ${classId} not found`);
    if (requester.role !== Role.ADMIN && cls.teacherId !== requester.id) {
      throw new ForbiddenException('You do not teach this class');
    }
    return cls;
  }

  async assignToClass(classId: string, dto: AssignProblemDto, requester: AuthenticatedUser) {
    await this.assertManagesClass(classId, requester);

    const problem = await this.prisma.problem.findUnique({ where: { id: dto.problemId } });
    if (!problem) throw new NotFoundException(`Problem ${dto.problemId} not found`);

    const existing = await this.prisma.classProblem.findUnique({
      where: { classId_problemId: { classId, problemId: dto.problemId } },
    });

    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    if (existing) {
      return this.prisma.classProblem.update({
        where: { id: existing.id },
        data: { dueDate },
      });
    }

    return this.prisma.classProblem.create({
      data: { classId, problemId: dto.problemId, dueDate },
    });
  }

  async unassignFromClass(classId: string, problemId: string, requester: AuthenticatedUser) {
    await this.assertManagesClass(classId, requester);

    const existing = await this.prisma.classProblem.findUnique({
      where: { classId_problemId: { classId, problemId } },
    });
    if (!existing) throw new NotFoundException('That problem is not assigned to this class');

    await this.prisma.classProblem.delete({ where: { id: existing.id } });
    return { success: true };
  }

  async listClassProblems(classId: string, requester: AuthenticatedUser) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException(`Class ${classId} not found`);

    const isStudent = requester.role === Role.STUDENT;
    if (isStudent) {
      const enrolled = await this.prisma.enrollment.count({
        where: { classId, userId: requester.id },
      });
      if (enrolled === 0) throw new ForbiddenException('You are not enrolled in this class');
    } else if (requester.role === Role.TEACHER && cls.teacherId !== requester.id) {
      throw new ForbiddenException('You do not teach this class');
    }

    const assignments = await this.prisma.classProblem.findMany({
      where: {
        classId,
        ...(isStudent ? { problem: { isPublished: true } } : {}),
      },
      include: { problem: true },
      orderBy: { assignedAt: 'asc' },
    });

    return assignments.map((a) => ({
      id: a.id,
      dueDate: a.dueDate,
      assignedAt: a.assignedAt,
      problem: this.serialize(a.problem, isStudent),
    }));
  }
}
