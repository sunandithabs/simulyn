import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@simulyn/shared';
import archiver from 'archiver';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ResearchService } from './research.service';

export class ConsentDto {
  // Body is intentionally minimal: presence of a POST from an authenticated
  // user is the consent action itself; no extra fields required.
}

export class SurveyDto {
  @IsArray()
  @ArrayMinSize(10)
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  susAnswers!: number[];

  @IsOptional()
  @IsString()
  freeText?: string;
}

@ApiTags('research')
@ApiBearerAuth()
@Controller('research')
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether the current user has given consent / taken the survey' })
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.research.status(user.id);
  }

  @Post('consent')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Record study consent for the current user' })
  consent(@CurrentUser() user: AuthenticatedUser) {
    return this.research.recordConsent(user.id);
  }

  @Post('survey')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit the exit System Usability Scale survey' })
  survey(@Body() dto: SurveyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.research.recordSurvey(user.id, dto.susAnswers, dto.freeText);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Download a pseudonymized zip of all study data as CSVs' })
  async export(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const files = await this.research.exportStudyData(user);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="simulyn-study-export.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    for (const [name, csv] of Object.entries(files)) {
      archive.append(csv, { name: `${name}.csv` });
    }
    await archive.finalize();
  }
}
