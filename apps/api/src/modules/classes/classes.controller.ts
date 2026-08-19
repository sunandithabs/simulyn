import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ClassesService, type ClassStudentProgress, type ClassWithCounts } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { EnrollStudentsDto, JoinClassDto } from './dto/enroll-students.dto';
import { UpdateClassDto } from './dto/update-class.dto';

@ApiTags('classes')
@ApiBearerAuth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Create a class — a unique 6-character join code is generated' })
  create(@Body() dto: CreateClassDto, @CurrentUser() user: AuthenticatedUser): Promise<ClassWithCounts> {
    return this.classesService.create(dto, user);
  }

  @Get()
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiOperation({
    summary: 'List classes',
    description: 'Teachers see the classes they own, students the ones they joined, admins all of them.',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<ClassWithCounts[]> {
    return this.classesService.findAll(user, includeArchived === 'true');
  }

  @Post('join')
  @Roles(Role.STUDENT, Role.TEACHER)
  @ApiOperation({ summary: 'Join a class using its code' })
  join(@Body() dto: JoinClassDto, @CurrentUser() user: AuthenticatedUser): Promise<ClassWithCounts> {
    return this.classesService.join(dto.code, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Class detail with enrollment, problem and exam counts' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<ClassWithCounts> {
    return this.classesService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Update a class (owner teacher or admin)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClassWithCounts> {
    return this.classesService.update(id, dto, user);
  }

  @Post(':id/enroll')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Enroll students by user id' })
  enroll(
    @Param('id') id: string,
    @Body() dto: EnrollStudentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ enrolled: number; skipped: number; notFound: string[] }> {
    return this.classesService.enroll(id, dto, user);
  }

  @Get(':id/students')
  @ApiOperation({ summary: 'Enrolled students with their progress stats' })
  students(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClassStudentProgress[]> {
    return this.classesService.students(id, user);
  }

  @Delete(':id/students/:userId')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Remove a student from a class' })
  removeStudent(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    return this.classesService.removeStudent(id, userId, user);
  }
}
