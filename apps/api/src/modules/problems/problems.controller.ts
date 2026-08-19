import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { PaginatedResult } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateProblemDto } from './dto/create-problem.dto';
import { QueryProblemsDto } from './dto/query-problems.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { ProblemsService, type ProblemView } from './problems.service';

@ApiTags('problems')
@ApiBearerAuth()
@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Create a problem with its test cases and hints' })
  create(@Body() dto: CreateProblemDto, @CurrentUser() user: AuthenticatedUser): Promise<ProblemView> {
    return this.problemsService.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List problems',
    description: 'Students only ever receive published problems, without hidden test cases.',
  })
  findAll(
    @Query() query: QueryProblemsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<ProblemView>> {
    return this.problemsService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Problem detail',
    description:
      'Teachers and admins see every test case and the electronics answer key; students see neither.',
  })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<ProblemView> {
    return this.problemsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Update a problem (author or admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProblemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProblemView> {
    return this.problemsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a problem (author or admin, only while it has no submissions)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<{ success: boolean }> {
    return this.problemsService.remove(id, user);
  }
}
