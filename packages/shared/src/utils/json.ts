/**
 * Helpers for the JSON-encoded string columns forced on us by SQLite.
 * Every read is defensive: a malformed column must never take down a request.
 */

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseJsonOrNull<T>(value: string | null | undefined): T | null {
  return parseJson<T | null>(value, null);
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Reads a JSON string-array column (Problem.tags, Problem.constraints). */
export function parseStringList(value: string | null | undefined): string[] {
  const parsed = parseJson<unknown>(value, []);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
}
