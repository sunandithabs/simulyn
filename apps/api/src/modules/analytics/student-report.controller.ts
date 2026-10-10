import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Roles(Role.STUDENT)
@Controller('me')
export class StudentReportController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('report')
  @ApiOperation({ summary: 'The signed-in student\'s own progress report' })
  report(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.myReport(user);
  }
}
