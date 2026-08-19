import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@simulyn/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MentorHintDto } from './dto/mentor.dto';
import { MentorService, type HintResponse } from './mentor.service';

@ApiTags('mentor')
@ApiBearerAuth()
@Controller('mentor')
export class MentorController {
  constructor(private readonly mentor: MentorService) {}

  @Post('hint')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Socratic hint for the student’s current code',
    description:
      'Answers are cached by a hash of problem + language + level + code. Rate limited to 10 per minute per user.',
  })
  hint(@Body() dto: MentorHintDto, @CurrentUser('id') userId: string): Promise<HintResponse> {
    return this.mentor.hint(dto, userId);
  }

  @Get('status')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Configured AI providers' })
  status() {
    return this.mentor.status();
  }
}
