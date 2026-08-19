import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';

import { REFRESH_COOKIE } from '../../../config/configuration';
import type { AuthenticatedUser, RefreshPayload } from '../../../common/types/authenticated-user';
import { AuthService } from '../auth.service';

export interface RefreshRequestUser extends AuthenticatedUser {
  /** The raw cookie value, so the service can rotate the stored record. */
  refreshToken: string;
}

/**
 * Validates the refresh token carried in the httpOnly cookie. Signature and
 * expiry only — revocation is checked by AuthService.refresh(), which also
 * rotates the stored token.
 */
@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: (req: Request): string | null => {
        const cookies = req.cookies as Record<string, string> | undefined;
        return cookies?.[REFRESH_COOKIE] ?? null;
      },
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.refreshSecret') ?? 'change-me-too',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: RefreshPayload): Promise<RefreshRequestUser> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_COOKIE];
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    const user = await this.authService.findActiveUser(payload.sub);
    if (!user) throw new UnauthorizedException('Account not found or deactivated');

    return { ...user, refreshToken };
  }
}
