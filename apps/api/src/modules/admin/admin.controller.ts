import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';

import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'System-wide counts for the admin dashboard' })
  overview() {
    return this.admin.overview();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Uptime, memory, database size, execution capacity and live socket count',
  })
  health() {
    return this.admin.health();
  }

  @Get('settings')
  @ApiOperation({
    summary: 'Effective runtime configuration (read-only, secrets masked)',
  })
  settings() {
    return this.admin.settings();
  }
}
