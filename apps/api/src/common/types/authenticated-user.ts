import type { Role } from '@simulyn/shared';

/** Shape attached to `request.user` by the JWT strategy. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string | null;
  role: Role;
  mustChangePassword: boolean;
}

/** Access-token payload. */
export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
}

/** Refresh-token payload — carries a token id so it can be revoked. */
export interface RefreshPayload extends JwtPayload {
  jti: string;
}
