/**
 * Role constants. Mirrors the `Role` enum in prisma/schema.prisma.
 * Kept as plain string literals so the frontend can use them without
 * pulling in the generated Prisma client.
 */
export const ROLES = {
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  ADMIN: 'ADMIN',
} as const;

export type RoleKey = keyof typeof ROLES;
export type RoleValue = (typeof ROLES)[RoleKey];

export const ROLE_VALUES: RoleValue[] = [ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN];

export const ROLE_LABELS: Record<RoleValue, string> = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  ADMIN: 'Administrator',
};

/** Default landing route per role, used by the login redirect. */
export const ROLE_HOME_ROUTE: Record<RoleValue, string> = {
  STUDENT: '/student',
  TEACHER: '/teacher',
  ADMIN: '/admin',
};

/** Higher rank implies every capability of the lower ranks. */
export const ROLE_RANK: Record<RoleValue, number> = {
  STUDENT: 1,
  TEACHER: 2,
  ADMIN: 3,
};

export function hasAtLeastRole(role: RoleValue, minimum: RoleValue): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
