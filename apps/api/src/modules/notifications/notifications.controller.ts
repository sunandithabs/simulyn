import {
  Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, NotFoundException, Param, Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@simulyn/shared';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

export class CreateAnnouncementDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  title!: string;

  @IsString() @IsNotEmpty() @MaxLength(5000)
  body!: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('notifications')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user.id);
  }

  @Get('notifications/unread-count')
  async unread(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(user.id);
  }

  @Post('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  read(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(user.id, id);
  }

  private async assertAccess(classId: string, user: AuthenticatedUser, manage: boolean) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');
    if (user.role === Role.ADMIN || cls.teacherId === user.id) return cls;
    if (manage) throw new ForbiddenException('You do not teach this class');
    const enrolled = await this.prisma.enrollment.count({ where: { classId, userId: user.id } });
    if (!enrolled) throw new ForbiddenException('You are not in this class');
    return cls;
  }

  @Get('classes/:classId/announcements')
  async announcements(@Param('classId') classId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.assertAccess(classId, user, false);
    return this.prisma.announcement.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { author: { select: { displayName: true } } },
    });
  }

  @Post('classes/:classId/announcements')
  @Roles(Role.TEACHER, Role.ADMIN)
  async announce(
    @Param('classId') classId: string,
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const cls = await this.assertAccess(classId, user, true);
    const a = await this.prisma.announcement.create({
      data: { classId, authorId: user.id, title: dto.title.trim(), body: dto.body.trim() },
    });
    await this.notifications.notifyClass(classId, {
      type: 'ANNOUNCEMENT',
      title: `${cls.name}: ${a.title}`,
      body: a.body.slice(0, 500),
    });
    return a;
  }
}
