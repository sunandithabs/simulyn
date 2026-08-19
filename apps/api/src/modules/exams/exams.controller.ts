import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateExamDto, SubmitExamDto, UpdateExamDto } from './dto/exam.dto';
import { ExamsService } from './exams.service';

@ApiTags('exams')
@ApiBearerAuth()
@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Create an exam with its problem set' })
  create(@Body() dto: CreateExamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.exams.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'List exams',
    description: 'Students see published exams for their classes, with their own attempt attached.',
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.exams.findAll(user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Exam detail',
    description:
      'Enrolled students always see the schedule; the problems are only included once they have an open attempt.',
  })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.exams.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Update an exam (the problem set locks once anyone has started)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete an exam that has no attempts' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.exams.remove(id, user);
  }

  @Post(':id/start')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start the exam',
    description:
      'Creates the attempt with a per-student shuffled question order and returns the questions plus the hard deadline.',
  })
  start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.exams.start(id, user);
  }

  @Post(':id/submit')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit the exam and freeze the score' })
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitExamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.submit(id, dto, user);
  }

  @Get(':id/results')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Every student’s score, integrity and violation count' })
  results(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.exams.results(id, user);
  }

  @Get(':id/attempts/:attemptId')
  @ApiOperation({ summary: 'Attempt detail with submissions and the violation timeline' })
  attempt(
    @Param('id') id: string,
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exams.attemptDetail(id, attemptId, user);
  }
}
