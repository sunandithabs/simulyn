/** bcrypt work factor — matches the seed script in packages/shared. */
export const BCRYPT_ROUNDS = 10;

/** Characters used for class join codes: no 0/O/1/I to avoid transcription errors. */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;

/**
 * Usernames left out of research analytics (comma-separated env var, e.g.
 * "tester1,qa.bot"). Empty by default: every STUDENT account counts, so the
 * team's own accounts are included unless listed here.
 */
export const ANALYTICS_EXCLUDED_USERNAMES: string[] = (process.env.ANALYTICS_EXCLUDE_USERNAMES ?? '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);
