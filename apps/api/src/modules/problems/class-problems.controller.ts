import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AssignProblemDto } from './dto/assign-problem.dto';
import { ProblemsService } from './problems.service';

/** Assignment of problems to a class — nested under /classes/:classId/problems. */
@ApiTags('problems')
@ApiBearerAuth()
@Controller('classes/:classId/problems')
export class ClassProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Assign a problem to a class, optionally with a due date' })
  assign(
    @Param('classId') classId: string,
    @Body() dto: AssignProblemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.problemsService.assignToClass(classId, dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Problems assigned to a class' })
  list(@Param('classId') classId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.problemsService.listClassProblems(classId, user);
  }

  @Delete(':problemId')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Unassign a problem from a class' })
  unassign(
    @Param('classId') classId: string,
    @Param('problemId') problemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.problemsService.unassignFromClass(classId, problemId, user);
  }
}
