/**
 * Fails when the Prisma schema has a table, column or enum value that the
 * committed migrations never create. That drift is invisible in development
 * (`db push` syncs everything) and breaks production, where only migrations run.
 *
 * Usage: node scripts/check-migrations.mjs     (also: pnpm db:check)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'prisma');

function check(label, schemaPath, migrationsDir, hasEnums) {
  const schema = readFileSync(schemaPath, 'utf8');
  const sql = readdirSync(migrationsDir)
    .sort()
    .map((d) => join(migrationsDir, d, 'migration.sql'))
    .filter(existsSync)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  const models = new Set([...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]));
  const missing = [];

  for (const [, name, body] of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    // The SQLite flavour rebuilds tables, so a column counts if the table is created anywhere with it.
    const blocks = [
      ...sql.matchAll(new RegExp(`(?:CREATE TABLE "(?:new_)?${name}" \\([\\s\\S]*?\\n\\);|ALTER TABLE "${name}"[^;]*;)`, 'g')),
    ].map((m) => m[0]);
    if (blocks.length === 0) {
      missing.push(`table ${name}`);
      continue;
    }
    for (const line of body.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('@@')) continue;
      const [field, type] = t.split(/\s+/);
      if (!type || type.endsWith('[]') || models.has(type.replace('?', ''))) continue;
      if (!blocks.some((b) => b.includes(`"${field}"`))) missing.push(`${name}.${field}`);
    }
  }

  // SQLite stores enums as plain text, so only Postgres migrations declare their values.
  for (const [, name, body] of hasEnums ? schema.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm) : []) {
    for (const raw of body.split('\n')) {
      const v = raw.trim();
      if (v && !v.startsWith('//') && !sql.includes(`'${v}'`) && !sql.includes(`"${v}"`)) {
        missing.push(`enum ${name}.${v}`);
      }
    }
  }

  if (missing.length > 0) {
    console.error(`✖ ${label}: the schema has things no migration creates:\n  ${missing.join('\n  ')}`);
    return false;
  }
  console.log(`✔ ${label}: migrations cover the schema`);
  return true;
}

const ok = [
  check('postgres', join(root, 'postgres', 'schema.prisma'), join(root, 'postgres', 'migrations'), true),
  check('sqlite', join(root, 'schema.prisma'), join(root, 'migrations'), false),
].every(Boolean);
process.exit(ok ? 0 : 1);
