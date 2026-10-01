import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

import { REFRESH_COOKIE } from '../../config/configuration';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Rate limits per account rather than per IP, so a shared lab NAT does not put
 * a whole class behind one bucket. Falls back to the IP for public routes.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as AuthenticatedUser | undefined;
    if (user?.id) return Promise.resolve(`user:${user.id}`);

    const ips = req.ips as string[] | undefined;
    const ip = (ips?.length ? ips[0] : (req.ip as string | undefined)) ?? 'unknown';

    // Unauthenticated auth routes: key on the credential/session, not just the
    // IP, so a shared NAT does not put a whole class in one bucket.
    const url = String(req.originalUrl ?? req.url ?? '');
    if (url.startsWith('/api/auth/') || url.startsWith('/auth/')) {
      const body = req.body as { username?: unknown } | undefined;
      if (url.includes('/auth/login') && typeof body?.username === 'string') {
        // Per (account, IP): brute force on one account is still capped, but
        // other students on the same IP are unaffected.
        return Promise.resolve(`login:${body.username.trim().toLowerCase()}:${ip}`);
      }
      if (url.includes('/auth/refresh')) {
        const cookies = req.cookies as Record<string, string> | undefined;
        const token = cookies?.[REFRESH_COOKIE];
        if (token) {
          const digest = createHash('sha256').update(token).digest('hex').slice(0, 32);
          return Promise.resolve(`refresh:${digest}`);
        }
      }
    }

    return Promise.resolve(`ip:${ip}`);
  }
}
