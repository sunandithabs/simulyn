/** bcrypt work factor — matches the seed script in packages/shared. */
export const BCRYPT_ROUNDS = 10;

/** Characters used for class join codes: no 0/O/1/I to avoid transcription errors. */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;
