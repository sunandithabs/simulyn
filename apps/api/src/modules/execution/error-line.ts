import { normaliseJavaSource, type LangKey } from './executor';

/**
 * Maps a compiler or interpreter message back to a line in the student's own
 * code. The harness wraps their solution in a prelude and a driver, so a raw
 * line number from `g++` or a Python traceback points at the generated
 * program, not at what they typed.
 */

/** Lines of generated program that precede the student's code, or null if it is not found verbatim. */
export function codeOffset(lang: LangKey, program: string, userCode: string): number | null {
  const snippet = lang === 'java' ? normaliseJavaSource(userCode, true).body : userCode;
  const at = program.indexOf(snippet);
  if (at === -1) return null;
  return program.slice(0, at).split('\n').length - 1;
}

/**
 * The 1-based line in the student's code that a message complains about.
 *
 * Only line numbers that fall inside the student's code count, so frames in
 * the prelude or driver are skipped. A Python traceback lists the outermost
 * frame first, so the last match is the innermost; every other toolchain
 * reports the offending line first.
 */
export function locateErrorLine(
  lang: LangKey,
  text: string | null | undefined,
  offset: number | null,
  userCode: string,
): number | null {
  if (!text || offset === null) return null;

  const userLines = userCode.split('\n').length;
  const hits: number[] = [];
  for (const match of text.matchAll(/(?:\bline |\.(?:py|js|cpp|cc|java):)(\d+)/g)) {
    const line = Number(match[1]) - offset;
    if (line >= 1 && line <= userLines) hits.push(line);
  }
  if (hits.length === 0) return null;
  return lang === 'python' ? hits[hits.length - 1] : hits[0];
}
