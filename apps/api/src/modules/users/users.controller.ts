import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { PaginatedResult } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { BulkCreateResultDto, BulkCreateUsersDto } from './dto/bulk-create-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService, type PublicUser, type UserStats } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List users (admin)' })
  findAll(@Query() query: QueryUsersDto): Promise<PaginatedResult<PublicUser>> {
    return this.usersService.findAll(query);
  }

  @Get('lookup')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Search existing student accounts by username, name or email',
    description: 'Needs at least two characters. Returns at most 20 active students.',
  })
  lookup(@Query('q') q = '') {
    return this.usersService.lookupStudents(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user profile (admin, or your own account)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.usersService.findOne(id, user);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Progress stats for a user',
    description: 'Students may read their own; teachers may read students they teach; admins read anyone.',
  })
  stats(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<UserStats> {
    return this.usersService.stats(id, user);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a user (admin)' })
  create(@Body() dto: CreateUserDto): Promise<PublicUser> {
    return this.usersService.create(dto);
  }

  @Post('bulk')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Bulk-create accounts (teacher/admin)',
    description: 'Rows are processed independently — failures are reported without aborting the batch.',
  })
  bulkCreate(
    @Body() dto: BulkCreateUsersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BulkCreateResultDto> {
    return this.usersService.bulkCreate(dto, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a user',
    description: 'Admins may change any field; other users may only edit displayName, email and avatar on their own account.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublicUser> {
    return this.usersService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate a user (soft delete, admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.usersService.deactivate(id, user);
  }
}
