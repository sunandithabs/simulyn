import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

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
    return Promise.resolve(`ip:${ip}`);
  }
}
