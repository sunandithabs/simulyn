/**
 * A small, predictable code formatter.
 *
 * Monaco ships no formatter for Python, C++ or Java, and pulling in a full one
 * (Prettier, clang-format) for a practice editor is far more than this needs.
 * Everything here is whitespace only: it never reorders, wraps or rewrites a
 * token, so it cannot change what a program does.
 *
 *  - all languages: LF line endings, no trailing spaces, no run of more than
 *    one blank line, one newline at the end of the file.
 *  - C++, Java, JavaScript: lines are re-indented by brace depth, four spaces
 *    per level, with a continuation line indented one extra level.
 *  - Python: indentation is syntax, so it is left alone, except that a file
 *    indented purely with tabs is converted to four spaces.
 */

export type FormatLang = 'python' | 'javascript' | 'cpp' | 'java';

const INDENT = '    ';

/** Net change in brace depth over one line, ignoring braces in strings and comments. */
function scan(
  line: string,
  state: { block: boolean; template: boolean },
): { opens: number; closes: number; leadingClose: boolean; code: string } {
  let opens = 0;
  let closes = 0;
  let leadingClose = false;
  let code = '';
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    const next = line[i + 1];

    if (state.block) {
      if (ch === '*' && next === '/') {
        state.block = false;
        i += 2;
      } else i++;
      continue;
    }
    if (state.template) {
      if (ch === '\\') i += 2;
      else {
        if (ch === '`') state.template = false;
        i++;
      }
      continue;
    }
    if (ch === '/' && next === '/') break;
    if (ch === '/' && next === '*') {
      state.block = true;
      i += 2;
      continue;
    }
    if (ch === '`') {
      state.template = true;
      code += ch;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
      code += line.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === '{') opens++;
    if (ch === '}') {
      if (code.trim() === '') leadingClose = true;
      closes++;
    }
    code += ch;
    i++;
  }
  return { opens, closes, leadingClose, code };
}

function reindentBraces(lines: string[]): string[] {
  const out: string[] = [];
  const state = { block: false, template: false };
  let depth = 0;
  let previousCode = '';
  let inParens = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();
    // Inside a block comment or template literal the text is not ours to move.
    const wasInside = state.block || state.template;
    if (trimmed === '') {
      out.push('');
      continue;
    }

    const { opens, closes, leadingClose, code } = scan(trimmed, state);
    if (wasInside) {
      out.push(raw.replace(/\s+$/, ''));
      continue;
    }

    const preprocessor = trimmed.startsWith('#');
    // A line continues the previous statement when that one was left open:
    // an unclosed bracket, a trailing operator or comma, a brace-less `if`/
    // `for`/`while`/`else` body, or a leading `.`, `&&`, `||`, `?` or `:`.
    const prev = previousCode.trim();
    const leadingParen = /^[)\]]/.test(trimmed);
    const continues =
      !preprocessor &&
      prev !== '' &&
      !leadingClose &&
      !leadingParen &&
      !trimmed.startsWith('{') &&
      !/[;{}]$/.test(prev) &&
      !/^[@#]/.test(prev) &&
      !/^(case\b.*|default|public|private|protected)\s*:$/.test(prev) &&
      (inParens > 0 ||
        /[,+\-*/%&|^=?(\[.]$/.test(prev) ||
        /^(\}\s*)?(else\s+)?(if|for|while)\b.*\)$/.test(prev) ||
        prev === 'else' ||
        /^(\.|&&|\|\||\?|:)/.test(trimmed));

    const level = Math.max(0, depth - (leadingClose ? 1 : 0));
    const label = /^(case\b.*|default)\s*:$/.test(trimmed) || /^(public|private|protected)\s*:$/.test(trimmed);
    const indent = INDENT.repeat(label ? Math.max(0, level - 1) : level) + (continues ? INDENT : '');
    out.push(preprocessor ? trimmed : indent + trimmed);

    depth = Math.max(0, depth + opens - closes);
    for (const ch of code) {
      if (ch === '(') inParens++;
      else if (ch === ')') inParens = Math.max(0, inParens - 1);
    }
    previousCode = preprocessor ? '' : code.trim() !== '' ? code : previousCode;
  }
  return out;
}

function tidyPython(lines: string[]): string[] {
  const indented = lines.filter((line) => /^\s/.test(line) && line.trim() !== '');
  const tabsOnly = indented.length > 0 && indented.every((line) => /^\t+\S/.test(line));
  if (!tabsOnly) return lines;
  return lines.map((line) => line.replace(/^\t+/, (tabs) => INDENT.repeat(tabs.length)));
}

export function formatCode(lang: FormatLang, source: string): string {
  let lines = source.replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/[ \t]+$/, ''));

  lines = lang === 'python' ? tidyPython(lines) : reindentBraces(lines);

  const collapsed: string[] = [];
  for (const line of lines) {
    if (line === '' && collapsed.length > 0 && collapsed[collapsed.length - 1] === '') continue;
    collapsed.push(line);
  }
  while (collapsed.length > 0 && collapsed[0] === '') collapsed.shift();
  while (collapsed.length > 0 && collapsed[collapsed.length - 1] === '') collapsed.pop();

  return collapsed.length === 0 ? '' : `${collapsed.join('\n')}\n`;
}
