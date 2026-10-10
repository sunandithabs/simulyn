import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  CreateHackathonDto,
  CreateTeamDto,
  InviteDto,
  JoinTeamDto,
  ScoreDto,
  SubmissionDto,
  UpdateHackathonDto,
} from './dto/hackathon.dto';
import { HackathonsService } from './hackathons.service';

@ApiTags('hackathons')
@ApiBearerAuth()
@Controller('hackathons')
export class HackathonsController {
  constructor(private readonly hackathons: HackathonsService) {}

  @Get()
  @ApiOperation({ summary: 'Students: published hackathons. Teachers: their own. Admins: all.' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.list(user);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Host a new hackathon (created as a draft)' })
  create(@Body() dto: CreateHackathonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.create(dto, user);
  }

  @Get('invites/mine')
  @Roles(Role.STUDENT)
  myInvites(@CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.myInvites(user);
  }

  @Post('invites/:inviteId/accept')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  acceptInvite(@Param('inviteId') inviteId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.acceptInvite(inviteId, user);
  }

  @Post('invites/:inviteId/decline')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  declineInvite(@Param('inviteId') inviteId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.declineInvite(inviteId, user);
  }

  @Post(':id/invites')
  @Roles(Role.STUDENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Team leader invites a student by username' })
  invite(@Param('id') id: string, @Body() dto: InviteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.invite(id, dto.username, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateHackathonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.update(id, dto, user);
  }

  @Post(':id/teams')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Create a team (a team of one is an individual entry)' })
  createTeam(@Param('id') id: string, @Body() dto: CreateTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.createTeam(id, dto, user);
  }

  @Post(':id/join')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  join(@Param('id') id: string, @Body() dto: JoinTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.joinTeam(id, dto.code, user);
  }

  @Post(':id/leave')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  leave(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.leaveTeam(id, user);
  }

  @Put(':id/submission')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Create or update your team’s project submission (while live)' })
  submit(@Param('id') id: string, @Body() dto: SubmissionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.upsertSubmission(id, dto, user);
  }

  @Get(':id/teams')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Host view: all teams, submissions and scores' })
  teams(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.teams(id, user);
  }

  @Put(':id/submissions/:submissionId/score')
  @Roles(Role.TEACHER, Role.ADMIN)
  score(
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: ScoreDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hackathons.score(id, submissionId, dto, user);
  }

  @Get(':id/scoreboard')
  @ApiOperation({ summary: 'Live scoreboard (problem mode ranks by best scores)' })
  scoreboard(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.scoreboard(id, user);
  }

  @Get(':id/leaderboard')
  leaderboard(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hackathons.leaderboard(id, user);
  }
}
