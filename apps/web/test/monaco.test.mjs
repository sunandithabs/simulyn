// Regression test for self-hosted Monaco.
//
// Monaco's language services run in web workers. A worker has no document to
// resolve relative URLs against, so a root-relative path like
// '/monaco/vs/language/typescript/tsWorker.js' throws "Failed to parse URL"
// inside it. The editor must hand Monaco a bootstrap worker that sets an
// absolute baseUrl before loading Monaco's own worker entry point.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const source = readFileSync(join(webRoot, 'src', 'components', 'problem', 'code-editor.tsx'), 'utf8');

test('Monaco is loaded from this server, not a CDN', () => {
  assert.match(source, /loader\.config\(\{ paths: \{ vs: `\$\{MONACO_BASE\}\/vs` \} \}\)/);
  assert.doesNotMatch(source, /cdn\.jsdelivr|unpkg\.com/);
});

test('a MonacoEnvironment worker bootstrap is installed', () => {
  assert.match(source, /MonacoEnvironment/);
  assert.match(source, /getWorkerUrl/);
});

test('the worker bootstrap uses an absolute origin, not a root-relative path', () => {
  // window.location.origin is what makes the URL resolvable inside the worker.
  assert.match(source, /window\.location\.origin/);
  assert.match(source, /self\.MonacoEnvironment = \{ baseUrl: '\$\{origin\}\$\{MONACO_BASE\}\/' \}/);
  assert.match(source, /importScripts\('\$\{origin\}\$\{MONACO_BASE\}\/vs\/base\/worker\/workerMain\.js'\)/);
});

test('the worker URL is cached so object URLs are not leaked per worker', () => {
  assert.match(source, /if \(workerUrl\) return workerUrl/);
});

test('the bootstrap is guarded against server-side rendering', () => {
  assert.match(source, /typeof window !== 'undefined'/);
});

// The copy step runs on predev/prebuild, so these exist in a working tree that
// has been started at least once. Skipped rather than failed on a clean clone.
const assets = [
  'vs/loader.js',
  'vs/editor/editor.main.js',
  'vs/base/worker/workerMain.js',
  'vs/language/typescript/tsWorker.js',
];

test('the copied Monaco assets include the worker entry points', (t) => {
  const publicVs = join(webRoot, 'public', 'monaco');
  if (!existsSync(publicVs)) {
    t.skip('public/monaco not populated — run pnpm --filter web dev once');
    return;
  }
  for (const asset of assets) {
    assert.ok(existsSync(join(publicVs, asset)), `missing ${asset}`);
  }
});
