import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GamificationService, type LeaderboardRow } from './gamification.service';

@ApiTags('gamification')
@ApiBearerAuth()
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('me')
  @ApiOperation({ summary: 'Your XP, level, streak, rank and earned badges' })
  me(@CurrentUser('id') userId: string) {
    return this.gamification.me(userId);
  }

  @Get('leaderboard')
  @ApiQuery({ name: 'classId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Top 50 students, globally or within a class' })
  leaderboard(
    @CurrentUser('id') userId: string,
    @Query('classId') classId?: string,
    @Query('limit') limit?: string,
  ): Promise<LeaderboardRow[]> {
    const parsed = Number.parseInt(limit ?? '', 10);
    const take = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 50;
    return this.gamification.leaderboard(userId, classId, take);
  }

  @Get('badges')
  @ApiOperation({ summary: 'Every badge with your earned status' })
  badges(@CurrentUser('id') userId: string) {
    return this.gamification.badges(userId);
  }
}
