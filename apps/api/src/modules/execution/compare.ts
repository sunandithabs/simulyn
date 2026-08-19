/**
 * Structural comparison of a program's output against the expected value.
 *
 * Both sides are JSON literals, so `[0,1]` and `[0, 1]` must compare equal.
 * When either side is not valid JSON we fall back to a trimmed string compare,
 * which keeps plain-text problems working.
 */

const EPSILON = 1e-6;

export type Normalize = 'sortArray' | 'sortRows' | undefined;

function canonical(value: unknown, normalize: Normalize): unknown {
  if (!Array.isArray(value)) return value;

  if (normalize === 'sortArray') {
    return [...value].sort(byJson);
  }
  if (normalize === 'sortRows') {
    const rows = value.map((row) => (Array.isArray(row) ? [...row].sort(byJson) : row));
    return rows.sort(byJson);
  }
  return value;
}

function byJson(a: unknown, b: unknown): number {
  const sa = JSON.stringify(a) ?? '';
  const sb = JSON.stringify(b) ?? '';
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }

  return false;
}

function tryParse(value: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = value.trim();
  if (trimmed === '') return { ok: false };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false };
  }
}

export function outputsMatch(actual: string, expected: string, normalize: Normalize): boolean {
  const a = tryParse(actual);
  const b = tryParse(expected);

  if (a.ok && b.ok) {
    return deepEqual(canonical(a.value, normalize), canonical(b.value, normalize));
  }

  // Plain-text fallback: ignore trailing whitespace on each line.
  const clean = (s: string) =>
    s
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();

  return clean(actual) === clean(expected);
}
