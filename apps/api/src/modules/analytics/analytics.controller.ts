import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@simulyn/shared';
import { IsNotEmpty, IsString } from 'class-validator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AnalyticsService } from './analytics.service';

export class ClassroomInsightsDto {
  @IsString()
  @IsNotEmpty()
  classId!: string;
}

@ApiTags('analytics')
@ApiBearerAuth()
@Roles(Role.TEACHER, Role.ADMIN)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('class/:classId')
  @ApiOperation({ summary: 'Class overview: accuracy, activity and the weakest categories' })
  classOverview(@Param('classId') classId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.analytics.classOverview(classId, user);
  }

  @Get('class/:classId/students')
  @ApiOperation({ summary: 'Per-student breakdown including violations and XP' })
  classStudents(@Param('classId') classId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.analytics.classStudents(classId, user);
  }

  @Get('problem/:problemId')
  @ApiOperation({ summary: 'Problem stats: pass rate, attempts to solve, common errors' })
  problemStats(@Param('problemId') problemId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.analytics.problemStats(problemId, user);
  }

  @Post('classroom-insights')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'AI-generated teaching recommendations from the class statistics',
    description: 'Only aggregate numbers are sent to the model — no student names or code.',
  })
  insights(@Body() dto: ClassroomInsightsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.analytics.classroomInsights(dto.classId, user);
  }
}
