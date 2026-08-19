/**
 * Writes an initial migration from the schema without touching any database.
 *
 * `prisma migrate dev` wants to reset a database that was created with
 * `db push`, which would destroy local data. `migrate diff` renders the same
 * SQL offline, and `migrate resolve --applied` baselines it — the documented
 * way to adopt migrations on an existing database.
 *
 * Usage: node scripts/create-migration.mjs [sqlite|postgres] [name]
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const flavour = process.argv[2] === 'postgres' ? 'postgres' : 'sqlite';
const name = process.argv[3] ?? '0_init';

const schema =
  flavour === 'postgres'
    ? join('prisma', 'postgres', 'schema.prisma')
    : join('prisma', 'schema.prisma');
const migrationsDir =
  flavour === 'postgres'
    ? join(root, 'prisma', 'postgres', 'migrations', name)
    : join(root, 'prisma', 'migrations', name);

if (existsSync(join(migrationsDir, 'migration.sql'))) {
  console.log(`[migration] ${flavour}/${name} already exists — nothing to do`);
  process.exit(0);
}

const prisma = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';

const sql = execFileSync(
  prisma,
  [
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    schema,
    '--script',
  ],
  { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' },
);

await mkdir(migrationsDir, { recursive: true });
await writeFile(join(migrationsDir, 'migration.sql'), sql, 'utf8');

console.log(`[migration] wrote ${join(migrationsDir, 'migration.sql')} (${sql.split('\n').length} lines)`);
console.log(
  flavour === 'sqlite'
    ? '[migration] baseline an existing database with:\n  pnpm --filter @simulyn/shared exec prisma migrate resolve --applied ' + name
    : '[migration] apply on the server with: pnpm db:postgres:deploy',
);
