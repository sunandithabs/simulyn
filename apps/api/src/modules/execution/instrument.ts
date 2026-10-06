/**
 * Source instrumentation for C++ and Java traces.
 *
 * Compiled languages have no line tracer, so a step call carrying the locals in
 * scope is inserted after each statement inside function bodies. The output is
 * only ever a best effort: the caller compiles it and falls back to the plain
 * driver if that fails, so this must never be trusted to be valid on its own.
 */
import { MAX_TRACE_EVENTS, TRACE_MARKER } from './trace.types';

export type InstrumentLang = 'cpp' | 'java' | 'js';

type Kind = 'global' | 'class' | 'func' | 'block' | 'init';
interface Scope {
  kind: Kind;
  vars: string[];
}

const NOT_A_TYPE = new Set([
  'return', 'delete', 'throw', 'else', 'case', 'goto', 'break', 'continue', 'using',
  'typedef', 'new', 'namespace', 'public', 'private', 'protected', 'import', 'package',
  'yield', 'assert', 'do', 'if', 'for', 'while', 'switch', 'sizeof', 'cout', 'cin',
]);

const q = (text: string) => JSON.stringify(text);

function op(stmt: string): string {
  const s = stmt.trim();
  if (/^return\b/.test(s)) return 'return';
  if (/^(for|while|do|if|else|switch)\b/.test(s)) return 'visit';
  if (/\b(pop_back|pop_front|pop|erase|poll|remove|removeLast|removeFirst)\s*\(/.test(s)) return 'pop';
  if (/\b(push_back|push_front|push|emplace_back|emplace|insert|add|addLast|addFirst|offer)\s*\(/.test(s)) return 'push';
  if (/\bswap\s*\(/.test(s)) return 'swap';
  if (/==|!=|<=|>=|\s<\s|\s>\s/.test(s)) return 'compare';
  return 'assign';
}

function describe(stmt: string): string {
  const text = stmt.replace(/\s+/g, ' ').trim();
  return text.length > 110 ? `${text.slice(0, 107)}...` : text;
}

/** Last identifier of a parameter declaration, e.g. `vector<int>& nums` -> nums. */
function paramNames(header: string, lang: InstrumentLang): string[] {
  const open = header.indexOf('(');
  if (open === -1) return [];
  let depth = 0;
  let close = -1;
  for (let i = open; i < header.length; i++) {
    if (header[i] === '(') depth++;
    else if (header[i] === ')' && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close === -1) return [];

  const parts: string[] = [];
  let angle = 0;
  let cur = '';
  for (const ch of header.slice(open + 1, close)) {
    if (ch === '<') angle++;
    else if (ch === '>') angle--;
    if (ch === ',' && angle === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);

  const out: string[] = [];
  for (const part of parts) {
    const withoutDefault = part.split('=')[0];
    if (lang === 'js') {
      const bare = withoutDefault.trim().replace(/^\.\.\./, '');
      if (/^[A-Za-z_$][\w$]*$/.test(bare)) out.push(bare);
      continue;
    }
    const match = /([A-Za-z_]\w*)\s*(\[\s*\])*\s*$/.exec(withoutDefault.trim());
    // Needs a type in front of it, or `void` / a bare type would be mistaken for a name.
    if (match && /\s|[*&>\]]/.test(withoutDefault.trim().slice(0, match.index + 1))) out.push(match[1]);
  }
  return out;
}

/** Names declared (with an initialiser) by one statement. */
function declared(stmt: string, lang: InstrumentLang): string[] {
  const s = stmt.trim().replace(/;$/, '');
  if (lang === 'js') {
    const m = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(s);
    return m ? [m[1]] : [];
  }
  const first = /^(?:(?:const|static|final|unsigned|signed|long|short|volatile)\s+)*([A-Za-z_][\w:.]*)/.exec(s);
  if (!first || NOT_A_TYPE.has(first[1])) return [];

  const head =
    lang === 'cpp'
      ? /^(?:(?:const|static|constexpr|unsigned|signed|long|short|volatile)\s+)*([A-Za-z_][\w:]*(?:\s*<[^;=(){}]*>)?)(?:\s*[*&]+\s*|\s+)([A-Za-z_]\w*)\s*(=|\{|$)/
      : /^(?:final\s+)?([A-Za-z_][\w.]*(?:\s*<[^;=(){}]*>)?(?:\s*\[\s*\])*)\s+([A-Za-z_]\w*)\s*(=)/;
  const m0 = head.exec(s);
  if (!m0 || NOT_A_TYPE.has(m0[2])) return [];
  // C++ objects default-construct, so `unordered_map<int,int> seen;` is safe to read.
  // A bare `int x;` is indeterminate, so it is skipped.
  if (!m0[3] && !/<|^(?:std::)?(?:string|stack|queue|deque|vector|set|map)$/.test(m0[1])) return [];
  const names = [m0[2]];

  // `int a = 0, b = 1;` — later declarators, split at top-level commas.
  let depth = 0;
  let cur = '';
  const segments: string[] = [];
  for (const ch of s) {
    if ('(<[{'.includes(ch)) depth++;
    else if (')>]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      segments.push(cur);
      cur = '';
    } else cur += ch;
  }
  segments.push(cur);
  for (const seg of segments.slice(1)) {
    const m = /^\s*[*&]*\s*([A-Za-z_]\w*)\s*=/.exec(seg);
    if (m) names.push(m[1]);
  }
  return names;
}

/** Loop-header variables: `for (int i = 0; ...)`, `for (auto x : xs)`, `catch (E e)`. */
function headerVars(header: string, lang: InstrumentLang): string[] {
  const inner = header.slice(header.indexOf('(') + 1, header.lastIndexOf(')'));
  if (/^\s*catch\b/.test(header)) {
    const m = /([A-Za-z_]\w*)\s*$/.exec(inner.trim());
    return m ? [m[1]] : [];
  }
  if (lang === 'js') {
    const each = /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+(?:of|in)\b/.exec(inner);
    if (each) return [each[1]];
    return declared(inner.split(';')[0], lang);
  }
  const colon = inner.indexOf(':');
  if (colon !== -1 && !inner.includes(';')) {
    const m = /([A-Za-z_]\w*)\s*$/.exec(inner.slice(0, colon).trim());
    return m ? [m[1]] : [];
  }
  return declared(inner.split(';')[0], lang);
}

export function instrumentSource(
  code: string,
  lang: InstrumentLang,
): { code: string; steps: number } | null {
  const stack: Scope[] = [{ kind: 'global', vars: [] }];
  let out = '';
  let stmt = ''; // text of the statement being read, comments removed
  let stmtOutStart = 0; // where that statement begins in `out`
  let paren = 0;
  let parenText = '';
  let pending: string[] = [];
  let steps = 0;
  let fnName = '';
  let className = '';
  let stmtStart = 0;

  const lineStarts = [0];
  for (let k = 0; k < code.length; k++) if (code[k] === '\n') lineStarts.push(k + 1);
  const lineAt = (idx: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= idx) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const touch = (idx: number) => {
    if (!stmt.trim() && !/\s/.test(code[idx])) stmtStart = idx;
  };

  const top = () => stack[stack.length - 1];
  const inBody = () => top().kind === 'func' || top().kind === 'block';
  const visible = (): string[] => {
    // Outermost first (parameters, then locals), inner scopes shadow outer ones.
    let from = stack.length - 1;
    while (from > 0 && stack[from].kind !== 'func') from--;
    const names: string[] = [];
    for (let i = from; i < stack.length; i++) {
      for (const v of stack[i].vars) {
        const at = names.indexOf(v);
        if (at !== -1) names.splice(at, 1);
        names.push(v);
      }
    }
    return names.slice(0, 14);
  };
  const step = (kind: string, text: string): string => {
    steps++;
    const vars = visible();
    const head = `${q(kind)},${q(describe(text))},${lineAt(stmtStart)},${q(fnName)}`;
    if (lang === 'cpp') {
      return ` simulyn::step(${head},{${vars.map((v) => `simulyn::mk(${q(v)},${v})`).join(',')}});`;
    }
    if (lang === 'js') return ` __sim.step(${head},{${vars.join(',')}});`;
    return ` Sim.step(${head}${vars.map((v) => `,${q(v)},${v}`).join('')});`;
  };
  const resetStmt = () => {
    stmt = '';
    stmtOutStart = out.length;
  };

  const n = code.length;
  let i = 0;
  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];

    // Preprocessor line (C++): copied untouched.
    if (lang === 'cpp' && ch === '#' && /^\s*$/.test(code.slice(code.lastIndexOf('\n', i - 1) + 1, i))) {
      let end = i;
      while (end < n && (code[end] !== '\n' || code[end - 1] === '\\')) end++;
      out += code.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '/' && next === '/') {
      let end = code.indexOf('\n', i);
      if (end === -1) end = n;
      out += code.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '/' && next === '*') {
      let end = code.indexOf('*/', i + 2);
      end = end === -1 ? n : end + 2;
      out += code.slice(i, end);
      i = end;
      continue;
    }
    if (ch === '"' || ch === "'" || (lang === 'js' && ch === '`')) {
      let end = i + 1;
      while (end < n && code[end] !== ch) end += code[end] === '\\' ? 2 : 1;
      end = Math.min(end + 1, n);
      const lit = code.slice(i, end);
      touch(i);
      out += lit;
      stmt += lit;
      if (paren > 0) parenText += lit;
      i = end;
      continue;
    }

    if (ch === '(') {
      if (paren === 0) parenText = '';
      touch(i);
      paren++;
    }
    if (paren > 0) {
      parenText += ch;
      stmt += ch;
      out += ch;
      i++;
      if (ch === ')' && --paren === 0) {
        const before = stmt.slice(0, stmt.length - parenText.length);
        const kw = /(?:^|\W)(for|catch)\s*$/.exec(before);
        pending = kw ? headerVars(`${kw[1]}${parenText}`, lang) : [];
      }
      continue;
    }

    if (ch === '{') {
      const header = stmt.trim();
      const parent = top();
      let kind: Kind = 'init';
      if (parent.kind === 'global' || parent.kind === 'class') {
        if (/\b(class|struct|interface|namespace)\b/.test(header) && !header.includes('=')) kind = 'class';
        else if (
          header.includes('(') &&
          !/^(if|for|while|switch)\b/.test(header) &&
          (lang === 'js'
            ? /(?:\)|=>)\s*$/.test(header)
            : /\)\s*(?:(?:const|noexcept|override|final|mutable)\s*|throws\s+[\w.,\s]+)*$/.test(header))
        )
          kind = 'func';
      } else if (parent.kind === 'func' || parent.kind === 'block') {
        if (
          header === '' ||
          /^(?:else\s+if|if|else|for|while|do|try|switch|catch|finally|synchronized)\b/.test(header) ||
          /^(?:case\b[^:]*|default)\s*:$/.test(header)
        )
          kind = 'block';
      }

      if (kind === 'class') {
        const cm = /\b(?:class|struct|interface)\s+([A-Za-z_]\w*)/.exec(header);
        if (cm) className = cm[1];
      }
      const scope: Scope = { kind, vars: [] };
      if (kind === 'func') {
        const assigned = /([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\()/.exec(header);
        const nm = assigned ?? /([A-Za-z_$][\w$]*)\s*\(/.exec(header);
        // Constructors may need `this(...)`/`super(...)` first, so leave them alone.
        if (nm && (nm[1] === className || nm[1] === 'constructor')) {
          kind = 'init';
          scope.kind = 'init';
        } else {
          scope.vars = paramNames(header, lang);
          fnName = nm ? nm[1] : 'function';
        }
      }
      if (kind === 'block') scope.vars = pending;
      pending = [];
      stack.push(scope);
      out += ch;
      i++;

      if (kind === 'func') {
        out += lang === 'cpp' ? ' simulyn::Depth _simDepth;' : lang === 'java' ? ' Sim.depth++; try {' : ' __sim.depth++; try {';
        out += step('visit', `call ${fnName}(${scope.vars.join(', ')})`);
        resetStmt();
      } else if (kind === 'block') {
        // A statement directly inside `switch {` before the first case is illegal.
        if (header && !/^switch\b/.test(header)) out += step(op(header), header);
        resetStmt();
      } else if (kind === 'class') {
        resetStmt();
      } else {
        stmt += ch; // brace initialiser: the statement carries on
      }
      continue;
    }

    if (ch === '}') {
      const popped = stack.length > 1 ? stack.pop()! : top();
      if (popped.kind === 'func' && lang !== 'cpp') out += ` } finally { ${lang === 'java' ? 'Sim' : '__sim'}.depth--; } `;
      out += ch;
      i++;
      if (popped.kind === 'init') stmt += ch;
      else resetStmt();
      continue;
    }

    if (ch === ';') {
      out += ch;
      i++;
      const text = `${stmt.trim()};`;
      if (inBody() && stmt.trim()) {
        const bare = /^(return|break|continue|throw|goto|yield)\b/.test(stmt.trim());
        const escapes = /\b(return|break|continue|throw|goto|yield)\b/.test(stmt);
        if (/^return\b/.test(stmt.trim())) {
          // Report the return before it happens; nothing may follow it.
          out = out.slice(0, stmtOutStart) + step('return', text) + out.slice(stmtOutStart);
        } else if (!bare && !escapes && !/^\s*(else|catch|finally)\b/.test(code.slice(i, i + 120))) {
          const header = /^(?:for|while|if|else|switch)\b/.test(stmt.trim());
          if (!header) top().vars.push(...declared(stmt, lang));
          out += step(op(stmt), text);
        }
      }
      pending = [];
      resetStmt();
      continue;
    }

    // `public:` / `private:` are labels, not part of the next declaration.
    if (ch === ':' && lang === 'cpp' && /^(public|private|protected)$/.test(stmt.trim())) {
      out += ch;
      i++;
      resetStmt();
      continue;
    }
    touch(i);
    stmt += ch;
    out += ch;
    i++;
  }

  return steps > 0 ? { code: out, steps } : null;
}

// ─────────────────────────────────────────────────────────── support ──

const PTRS = ['i', 'j', 'k', 'l', 'r', 'lo', 'hi', 'mid', 'left', 'right', 'start', 'end', 'idx', 'index', 'p', 'q', 'fast', 'slow', 'pos', 'top', 'head', 'tail'];

export const CPP_STEP_SUPPORT = String.raw`
namespace simulyn {
inline int depth = 0;
struct Depth { Depth() { depth++; } ~Depth() { depth--; } };
struct Var { string name; string json; int hl; };

template <class T> string js(const T &v, int depth = 0);

template <class T, class = void> struct hasBegin : false_type {};
template <class T> struct hasBegin<T, void_t<decltype(declval<const T &>().begin()), decltype(declval<const T &>().end())>> : true_type {};
template <class T, class = void> struct hasMapped : false_type {};
template <class T> struct hasMapped<T, void_t<typename T::mapped_type>> : true_type {};
template <class T> constexpr bool isPair = false;
template <class A, class B> constexpr bool isPair<pair<A, B>> = true;

template <class T> string js(const T &v, int depth) {
    if (depth > 4) return "\"…\"";
    using D = remove_cv_t<remove_reference_t<T>>;
    if constexpr (is_same_v<D, bool>) return v ? "true" : "false";
    else if constexpr (is_same_v<D, char>) return "\"" + esc(string(1, v)) + "\"";
    else if constexpr (is_floating_point_v<D>) return std::isfinite((double)v) ? toJson((double)v) : "null";
    else if constexpr (is_arithmetic_v<D>) return to_string((long long)v);
    else if constexpr (is_convertible_v<D, string>) return "\"" + esc(string(v)) + "\"";
    else if constexpr (is_pointer_v<D>) {
        if constexpr (is_same_v<D, ListNode *> || is_same_v<D, TreeNode *>) return toJson(v);
        else return v ? "\"<ptr>\"" : "null";
    }
    else if constexpr (isPair<D>) return "[" + js(v.first, depth + 1) + "," + js(v.second, depth + 1) + "]";
    else if constexpr (hasMapped<D>::value && hasBegin<D>::value) {
        string o = "{"; int n = 0;
        for (auto &kv : v) {
            if (n++) o += ",";
            if (n > 100) { o += "\"…\":0"; break; }
            o += "\"" + esc(js(kv.first, depth + 1)) + "\":" + js(kv.second, depth + 1);
        }
        return o + "}";
    }
    else if constexpr (hasBegin<D>::value) {
        string o = "["; int n = 0;
        for (auto &e : v) {
            if (n++) o += ",";
            if (n > 100) { o += "\"…\""; break; }
            o += js(e, depth + 1);
        }
        return o + "]";
    }
    else return "\"?\"";
}

template <class T> Var mk(const char *name, const T &v) {
    int hl = -1;
    if constexpr (is_integral_v<remove_cv_t<remove_reference_t<T>>> && !is_same_v<remove_cv_t<remove_reference_t<T>>, bool>) {
        static const char *ptrs[] = {${PTRS.map(q).join(',')}};
        for (auto p : ptrs) if (string(p) == name && v >= 0 && v < 4096) hl = (int)v;
    }
    return Var{name, js(v), hl};
}

inline void step(const string &op, const string &desc, int line, const string &fn, initializer_list<Var> vars) {
    if (_traceStep >= TRACE_MAX) return;
    _traceStep++;
    string vs = "{", hs = "["; bool fv = true, fh = true;
    for (auto &v : vars) {
        if (!fv) vs += ","; fv = false;
        vs += "\"" + esc(v.name) + "\":" + v.json;
        if (v.hl >= 0) { if (!fh) hs += ","; fh = false; hs += to_string(v.hl); }
    }
    cout << ${q(TRACE_MARKER)} << "{\"step\":" << _traceStep << ",\"op\":\"" << op << "\",\"vars\":" << vs << "},\"highlights\":" << hs << "],\"line\":" << line << ",\"fn\":\"" << esc(fn) << "\",\"depth\":" << depth << ",\"description\":\"" << esc(desc) << "\"}" << endl;
}
}  // namespace simulyn
`;

export const JAVA_STEP_SUPPORT = String.raw`
class Sim {
    static final String[] PTRS = {${PTRS.map(q).join(',')}};

    static Object trim(Object v) {
        if (v instanceof int[] && ((int[]) v).length > 100) return Arrays.copyOf((int[]) v, 100);
        if (v instanceof Object[] && ((Object[]) v).length > 100) return Arrays.copyOf((Object[]) v, 100);
        return v;
    }

    static String json(Object v) {
        if (v instanceof Map) {
            StringBuilder sb = new StringBuilder("{");
            int n = 0;
            for (Map.Entry<?, ?> e : ((Map<?, ?>) v).entrySet()) {
                if (n++ > 0) sb.append(',');
                if (n > 100) { sb.append("\"…\":0"); break; }
                sb.append('"').append(Main.esc(String.valueOf(e.getKey()))).append("\":").append(json(e.getValue()));
            }
            return sb.append('}').toString();
        }
        return Main.toJson(trim(v));
    }

    static int depth = 0;

    static void step(String op, String desc, int line, String fn, Object... kv) {
        if (Main._traceStep >= Main.TRACE_MAX) return;
        Main._traceStep++;
        StringBuilder vs = new StringBuilder("{");
        TreeSet<Integer> hs = new TreeSet<>();
        boolean first = true;
        for (int i = 0; i + 1 < kv.length; i += 2) {
            String name = (String) kv[i];
            Object val = kv[i + 1];
            String js;
            try { js = json(val); } catch (Throwable t) { js = "null"; }
            if (!first) vs.append(',');
            first = false;
            vs.append('"').append(Main.esc(name)).append("\":").append(js);
            if (val instanceof Integer) {
                int x = (Integer) val;
                for (String p : PTRS) if (p.equals(name) && x >= 0 && x < 4096) hs.add(x);
            }
        }
        vs.append('}');
        System.out.println(${q(TRACE_MARKER)} + "{\"step\":" + Main._traceStep + ",\"op\":\"" + op
            + "\",\"vars\":" + vs + ",\"highlights\":" + hs + ",\"line\":" + line + ",\"fn\":\"" + Main.esc(fn)
            + "\",\"depth\":" + depth + ",\"description\":\"" + Main.esc(desc) + "\"}");
    }
}
`;

export const JS_STEP_SUPPORT = String.raw`
globalThis.__sim = {
  depth: 0,
  ptrs: ${q(PTRS.join(','))}.split(','),
  step(op, desc, line, fn, vars) {
    const safe = {};
    const marks = [];
    for (const key of Object.keys(vars)) {
      let value;
      try { value = vars[key]; } catch (e) { continue; }
      safe[key] = _simulynSafe(value);
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 4096 && this.ptrs.includes(key)) marks.push(value);
    }
    _simulynEmit(op, safe, marks.sort((a, b) => a - b), desc, { line, fn, depth: this.depth });
  },
};
`;
