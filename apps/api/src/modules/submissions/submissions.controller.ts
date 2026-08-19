import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@simulyn/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateSubmissionDto, QuerySubmissionsDto } from './dto/create-submission.dto';
import { SubmissionsService, type SubmissionResponse } from './submissions.service';

@ApiTags('submissions')
@ApiBearerAuth()
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Grade and record a submission',
    description:
      'Runs the code against every test case, stores the results, and awards XP on a first full solve outside an exam.',
  })
  create(
    @Body() dto: CreateSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponse> {
    return this.submissions.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List submissions (your own, or a student you teach)' })
  findAll(@Query() query: QuerySubmissionsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.submissions.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Submission detail with every test result' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.submissions.findOne(id, user);
  }
}

@ApiTags('submissions')
@ApiBearerAuth()
@Controller('problems/:id/submissions')
export class ProblemSubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'All submissions for a problem (class analytics)' })
  findForProblem(
    @Param('id') problemId: string,
    @Query() query: QuerySubmissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissions.findForProblem(problemId, query, user);
  }
}
