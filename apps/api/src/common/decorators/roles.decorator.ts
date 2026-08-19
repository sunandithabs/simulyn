import { SetMetadata } from '@nestjs/common';
import { Role } from '@simulyn/shared';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the listed roles.
 * ADMIN passes every check — see RolesGuard.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
