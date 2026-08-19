/**
 * Copies the Monaco editor assets into public/monaco so the editor loads from
 * this server instead of a CDN — the university deployment may have no
 * outbound internet access.
 */
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'public', 'monaco', 'vs');

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

try {
  const monacoPkg = require.resolve('monaco-editor/package.json');
  const source = join(dirname(monacoPkg), 'min', 'vs');

  if (!(await exists(source))) {
    console.warn('[monaco] min/vs not found — skipping, the editor will fall back to the CDN');
    process.exit(0);
  }

  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
  console.log('[monaco] assets copied to public/monaco/vs');
} catch (error) {
  console.warn(`[monaco] copy skipped: ${error.message}`);
}
