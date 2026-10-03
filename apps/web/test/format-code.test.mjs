// The formatter only moves whitespace. These tests pin that down: the token
// stream must come out identical, and the layout must be what a student expects.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { formatCode } = await import('../src/lib/format-code.ts');

const tokens = (text) => text.replace(/\s+/g, '');

test('braces languages are re-indented by depth', () => {
  const out = formatCode(
    'cpp',
    'class Solution {\npublic:\nint f(int x) {\nif (x > 0) {\nreturn 1;\n}\nreturn 0;\n}\n};\n',
  );
  assert.equal(
    out,
    'class Solution {\npublic:\n    int f(int x) {\n        if (x > 0) {\n            return 1;\n        }\n        return 0;\n    }\n};\n',
  );
});

test('braces inside strings and comments do not shift the indent', () => {
  const src = 'function f() {\nconst s = "{";\n// }\nreturn s;\n}\n';
  assert.equal(formatCode('javascript', src), 'function f() {\n    const s = "{";\n    // }\n    return s;\n}\n');
});

test('a multi-line call and a brace-less body get one extra level', () => {
  const out = formatCode('java', 'class A {\nint f(int a,\nint b) {\nif (a > b)\nreturn a;\nreturn b;\n}\n}\n');
  assert.equal(out, 'class A {\n    int f(int a,\n        int b) {\n        if (a > b)\n            return a;\n        return b;\n    }\n}\n');
});

test('case labels line up with their switch', () => {
  const out = formatCode('cpp', 'switch (x) {\ncase 1:\nbreak;\ndefault:\nbreak;\n}\n');
  assert.equal(out, 'switch (x) {\ncase 1:\n    break;\ndefault:\n    break;\n}\n');
});

test('preprocessor lines stay at the left margin', () => {
  assert.equal(formatCode('cpp', '#include <vector>\nint main() {\nreturn 0;\n}\n'), '#include <vector>\nint main() {\n    return 0;\n}\n');
});

test('python indentation is never touched', () => {
  const src = 'def f(x):\n  if x:\n      return 1   \n  return 0\n\n\n\n';
  assert.equal(formatCode('python', src), 'def f(x):\n  if x:\n      return 1\n  return 0\n');
});

test('a tab-indented python file becomes spaces', () => {
  assert.equal(formatCode('python', 'def f():\n\treturn 1\n'), 'def f():\n    return 1\n');
});

test('line endings, trailing space, blank runs and the final newline are normalised', () => {
  assert.equal(formatCode('javascript', 'a();  \r\n\r\n\r\n\r\nb();'), 'a();\n\nb();\n');
  assert.equal(formatCode('python', ''), '');
});

test('formatting is idempotent and never changes a token', () => {
  const samples = [
    ['cpp', 'class Solution {\npublic:\n  vector<int> twoSum(vector<int>& n, int t) {\n    unordered_map<int,int> m;\n    for (int i = 0; i < n.size(); i++) {\n      if (m.count(t - n[i]))\n        return {m[t - n[i]], i};\n      m[n[i]] = i;\n    }\n    return {};\n  }\n};\n'],
    ['java', 'import java.util.*;\nclass Solution {\n    public int f(int[] a) {\n        int s = 0;\n        for (int x : a) { s += x; }\n        return s;\n    }\n}\n'],
    ['javascript', 'const f = (a) => {\nreturn a\n  .map((x) => x * 2)\n  .filter(Boolean);\n};\n'],
    ['python', 'class Solution:\n    def f(self, a):\n        return sorted(a)\n'],
  ];
  for (const [lang, src] of samples) {
    const once = formatCode(lang, src);
    assert.equal(tokens(once), tokens(src), `${lang}: tokens changed`);
    assert.equal(formatCode(lang, once), once, `${lang}: not idempotent`);
  }
});
