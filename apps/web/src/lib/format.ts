import type { LangKey } from '@/lib/types';

/**
 * Tidies indentation for the languages Monaco ships no formatter for.
 * JavaScript is formatted by Monaco itself, so it is returned unchanged here.
 */
export function formatCode(lang: LangKey, code: string): string {
  const lines = code.replace(/\r\n/g, '\n').split('\n');

  if (lang === 'python') {
    const out = lines.map((line) => {
      const lead = /^[ \t]*/.exec(line)![0].replace(/\t/g, '    ');
      return (lead + line.trimStart()).trimEnd();
    });
    return `${out.join('\n').replace(/\n+$/, '')}\n`;
  }
  if (lang === 'javascript') return code;

  // C++ / Java: re-indent from brace and parenthesis depth.
  let depth = 0;
  let paren = 0;
  let inBlock = false;
  const out: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      out.push('');
      continue;
    }

    // Count brackets outside strings and comments.
    let opens = 0;
    let closes = 0;
    let leadingClose = line.startsWith('}');
    let parenDelta = 0;
    let quote = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const n = line[i + 1];
      if (inBlock) {
        if (c === '*' && n === '/') {
          inBlock = false;
          i++;
        }
        continue;
      }
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = '';
        continue;
      }
      if (c === '/' && n === '/') break;
      if (c === '/' && n === '*') {
        inBlock = true;
        i++;
        continue;
      }
      if (c === '"' || c === "'") quote = c;
      else if (c === '{') opens++;
      else if (c === '}') closes++;
      else if (c === '(') parenDelta++;
      else if (c === ')') parenDelta--;
    }

    const isLabel = /^(public|private|protected)\s*:$/.test(line) || /^(case\b.*|default)\s*:$/.test(line);
    const level = Math.max(0, depth - (leadingClose ? 1 : 0) - (isLabel ? 1 : 0));
    const extra = paren > 0 && !leadingClose ? paren * 2 : 0;
    out.push(' '.repeat(level * 4 + extra * 2) + line);

    depth = Math.max(0, depth + opens - closes);
    paren = Math.max(0, paren + parenDelta);
    leadingClose = false;
  }
  return `${out.join('\n').replace(/\n+$/, '')}\n`;
}
