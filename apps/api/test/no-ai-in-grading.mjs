// Grading and compilation must stay deterministic: no module on the path from a
// submission to its verdict may import the AI mentor, an LLM client or the network.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'modules');
const files = ['execution', 'submissions', 'exams', 'gamification'].flatMap((dir) =>
  readdirSync(join(src, dir), { recursive: true })
    .filter((f) => String(f).endsWith('.ts'))
    .map((f) => join(src, dir, String(f))),
);
const banned = /mentor|ollama|cloud-llm|openai|anthropic|\bfetch\(|axios|node:https?|from 'https?'/i;
let bad = 0;
for (const file of files) {
  const hit = readFileSync(file, 'utf8').split('\n').findIndex((l) => /^\s*(import|const .*require)/.test(l) && banned.test(l));
  if (hit !== -1) { console.error(`FAIL ${file}:${hit + 1}`); bad++; }
}
assert.equal(bad, 0, 'AI/network import found in the grading path');
console.log(`ok — ${files.length} grading-path files import no AI or network code`);
