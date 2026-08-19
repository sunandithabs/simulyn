import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Role, type User } from '@simulyn/shared';
import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import type { CookieOptions, Response } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import { REFRESH_COOKIE } from '../../config/configuration';
import { BCRYPT_ROUNDS } from '../../common/constants';
import type { AuthenticatedUser, JwtPayload, RefreshPayload } from '../../common/types/authenticated-user';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

/** Converts "15m" / "7d" / "3600" into milliseconds. */
export function durationToMs(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/i.exec(value.trim());
  if (!match) return 0;
  const amount = parseInt(match[1], 10);
  const unit = (match[2] ?? 's').toLowerCase();
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 1000;
  return amount * factor;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── helpers ────────────────────────────────────────────────────────

  /** Refresh tokens are stored hashed so a database leak cannot mint sessions. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private cookieOptions(): CookieOptions {
    const isProd = this.config.get<string>('nodeEnv') === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      path: '/',
      maxAge: durationToMs(this.config.get<string>('jwt.refreshExpiresIn') ?? '7d'),
    };
  }

  toAuthUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private async issueTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role };

    // `expiresIn` is typed as the `ms` StringValue union; ours comes from the
    // environment, so it is narrowed at the call site.
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.secret'),
      expiresIn: (this.config.get<string>('jwt.expiresIn') ?? '15m') as JwtSignOptions['expiresIn'],
    });

    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti: randomUUID() } satisfies RefreshPayload,
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        token: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + durationToMs(refreshExpiresIn)),
      },
    });

    return { accessToken, refreshToken };
  }

  // ── credential validation ──────────────────────────────────────────

  /** Accepts either a username or an email address. */
  async validateCredentials(identifier: string, password: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier.toLowerCase() }],
      },
    });

    // Compare regardless of whether the user exists, so timing does not leak
    // which usernames are registered.
    const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok) throw new UnauthorizedException('Invalid username or password');
    if (!user.isActive) throw new UnauthorizedException('This account has been deactivated');

    return user;
  }

  // ── endpoints ──────────────────────────────────────────────────────

  async login(identifier: string, password: string, res: Response): Promise<AuthResponseDto> {
    const user = await this.validateCredentials(identifier, password);

    const { accessToken, refreshToken } = await this.issueTokens(user);
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`${user.username} (${user.role}) signed in`);
    return { accessToken, user: this.toAuthUser(updated) };
  }

  /** Validates the refresh cookie, rotates it, and mints a new access token. */
  async refresh(rawToken: string | undefined, res: Response): Promise<AuthResponseDto> {
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');

    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(rawToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: this.hashToken(rawToken) },
      include: { user: true },
    });

    if (!stored || stored.userId !== payload.sub) {
      // Token verified but is not in the store: it was already rotated or
      // revoked. Treat every session for that user as compromised.
      await this.prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
      res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Refresh token has expired');
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    // Rotate: the presented token is consumed and replaced.
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    const { accessToken, refreshToken } = await this.issueTokens(stored.user);
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());

    return { accessToken, user: this.toAuthUser(stored.user) };
  }

  async logout(rawToken: string | undefined, res: Response): Promise<{ success: boolean }> {
    if (rawToken) {
      await this.prisma.refreshToken.deleteMany({ where: { token: this.hashToken(rawToken) } });
    }
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions(), maxAge: undefined });
    return { success: true };
  }

  /** Revokes every session for a user (used on password change). */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ success: boolean; mustChangePassword: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Account no longer exists');

    const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('The new password must differ from the current one');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
        mustChangePassword: false,
      },
    });

    // Force every other device to re-authenticate with the new password.
    await this.revokeAllSessions(userId);

    this.logger.log(`${user.username} changed their password`);
    return { success: true, mustChangePassword: false };
  }

  /**
   * Signs an admin in as another account, for reproducing a bug a student
   * reports. Deliberately constrained: admins only, never another admin, never
   * a deactivated account, and every use is logged with both usernames.
   */
  async impersonate(
    targetUserId: string,
    actor: AuthenticatedUser,
    res: Response,
  ): Promise<AuthResponseDto> {
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only an admin may impersonate another account');
    }
    if (targetUserId === actor.id) {
      throw new BadRequestException('You are already signed in as this account');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException(`User ${targetUserId} not found`);
    if (!target.isActive) {
      throw new BadRequestException('That account is deactivated — reactivate it first');
    }
    if (target.role === Role.ADMIN) {
      throw new ForbiddenException('Admin accounts cannot be impersonated');
    }

    const { accessToken, refreshToken } = await this.issueTokens(target);
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());

    this.logger.warn(`IMPERSONATION: ${actor.username} is now acting as ${target.username}`);

    return { accessToken, user: this.toAuthUser(target) };
  }

  /** Used by the JWT strategy on every request. */
  async findActiveUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return null;
    return this.toAuthUser(user);
  }

  isAdmin(role: Role): boolean {
    return role === Role.ADMIN;
  }
}
