/**
 * Derives the PostgreSQL schema from the SQLite one.
 *
 * Prisma will not accept `env()` for a datasource provider, and keeping two
 * hand-written schemas guarantees they drift. The models are already written to
 * be portable (no `@db.Text`, no native arrays — JSON is stored as strings), so
 * the only difference is the datasource block.
 *
 * Run with: pnpm --filter @simulyn/shared db:postgres:schema
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const prismaDir = join(here, '..', 'prisma');
const source = join(prismaDir, 'schema.prisma');
const targetDir = join(prismaDir, 'postgres');
const target = join(targetDir, 'schema.prisma');

const schema = await readFile(source, 'utf8');

if (!/provider\s*=\s*"sqlite"/.test(schema)) {
  console.error('[postgres-schema] the base schema is no longer sqlite — check prisma/schema.prisma');
  process.exit(1);
}

const converted = schema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');

const header = [
  '// GENERATED FILE — do not edit.',
  '// Produced from prisma/schema.prisma by scripts/generate-postgres-schema.mjs.',
  '// Edit the base schema, then re-run: pnpm db:postgres:schema',
  '',
].join('\n');

await mkdir(targetDir, { recursive: true });
await writeFile(target, header + converted, 'utf8');

console.log(`[postgres-schema] wrote ${target}`);
