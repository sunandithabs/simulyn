import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotifyInput { type: string; title: string; body?: string; link?: string }

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private cleanup?: NodeJS.Timeout;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Read notifications older than 30 days are dropped once a day.
    this.cleanup = setInterval(() => {
      void this.prisma.notification
        .deleteMany({ where: { readAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } })
        .catch((e: Error) => this.logger.warn(`Notification cleanup failed: ${e.message}`));
    }, 86_400_000);
    this.cleanup.unref();
  }

  onModuleDestroy() {
    if (this.cleanup) clearInterval(this.cleanup);
  }

  async notify(userIds: string[], n: NotifyInput): Promise<void> {
    if (!userIds.length) return;
    await this.prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, ...n })) });
    void this.email(userIds, n);
  }

  /** Optional email copy; only active when SMTP_HOST is set. Never blocks or fails the caller. */
  private async email(userIds: string[], n: NotifyInput): Promise<void> {
    const host = process.env.SMTP_HOST;
    if (!host) return;
    try {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { email: true } });
      const web = process.env.WEB_URL ?? '';
      for (const u of users) {
        await transport.sendMail({
          from: process.env.SMTP_FROM ?? 'Simulyn <no-reply@simulyn.local>',
          to: u.email,
          subject: n.title,
          text: `${n.body ?? ''}${n.link ? `\n\n${web}${n.link}` : ''}`.trim() || n.title,
        });
      }
    } catch (e) {
      this.logger.warn(`Email delivery failed: ${(e as Error).message}`);
    }
  }

  async notifyStudents(n: NotifyInput): Promise<void> {
    const rows = await this.prisma.user.findMany({ where: { role: 'STUDENT', isActive: true }, select: { id: true } });
    await this.notify(rows.map((r) => r.id), n);
  }

  async notifyClass(classId: string, n: NotifyInput): Promise<void> {
    const rows = await this.prisma.enrollment.findMany({ where: { classId }, select: { userId: true } });
    await this.notify(rows.map((r) => r.userId), n);
  }

  list(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id?: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
