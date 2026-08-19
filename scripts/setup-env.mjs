/**
 * Writes the three .env files a working copy needs. They are all gitignored, so
 * a fresh clone has none of them and `pnpm db:push` fails before it starts.
 *
 *   packages/shared/.env   DATABASE_URL — Prisma resolves this relative to the
 *                          schema, so the repo-root .env is never consulted
 *   apps/api/.env          the API's own config; wins over the root .env
 *   apps/web/.env.local    NEXT_PUBLIC_API_URL, inlined at build time
 *
 * Each is rendered from its committed .env.example, so the templates stay the
 * single source of truth for which keys exist.
 *
 *   node scripts/setup-env.mjs                 ask which address to bind to
 *   node scripts/setup-env.mjs --host=<ip>     use this address, no prompt
 *   node scripts/setup-env.mjs --localhost     localhost only, no prompt
 *   node scripts/setup-env.mjs --force         overwrite files that exist
 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (name) => {
  const hit = args.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
};

const force = has('--force');
const localhostOnly = has('--localhost');
const hostArg = valueOf('--host');

const WEB_PORT = 3000;
const API_PORT = 3001;

/**
 * Every routable IPv4 this machine owns, best candidate first. 169.254.* is
 * link-local — an adapter that failed to get a lease, never reachable from
 * another device — so it is dropped rather than offered.
 */
function lanAddresses() {
  const rank = (ip) => {
    if (ip.startsWith('192.168.')) return 0;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
    if (ip.startsWith('10.')) return 2;
    return 3;
  };

  return Object.entries(networkInterfaces())
    .flatMap(([name, addresses]) =>
      (addresses ?? [])
        .filter((a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))
        .map((a) => ({ name, address: a.address })),
    )
    .sort((a, b) => rank(a.address) - rank(b.address));
}

/**
 * Replaces KEY's value in a .env body, keeping the file's own comments and
 * ordering. Appends the key when the template does not already carry it.
 */
function setKey(body, key, value) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(body)) return body.replace(pattern, line);
  return `${body.replace(/\n*$/, '')}\n${line}\n`;
}

const secret = () => randomBytes(32).toString('hex');

async function render(examplePath, targetPath, transform) {
  const target = join(root, targetPath);
  const shortName = relative(root, target).replace(/\\/g, '/');

  if (existsSync(target) && !force) {
    console.log(`  skip   ${shortName} — already exists (use --force to replace)`);
    return false;
  }

  const example = join(root, examplePath);
  if (!existsSync(example)) {
    console.error(`  FAIL   ${shortName} — template ${examplePath} is missing`);
    process.exitCode = 1;
    return false;
  }

  const replaced = existsSync(target);
  const body = transform(await readFile(example, 'utf8'));
  await writeFile(target, body, 'utf8');
  console.log(`  ${replaced ? 'replace' : 'write  '} ${shortName}`);
  return true;
}

// ── choose the address the browser will use ─────────────────────────
let host = 'localhost';

if (hostArg) {
  host = hostArg;
} else if (!localhostOnly) {
  const candidates = lanAddresses();

  if (candidates.length === 0) {
    console.log('No LAN address found — configuring for localhost only.\n');
  } else if (!process.stdin.isTTY) {
    console.log('Not a terminal — configuring for localhost only.');
    console.log('Pass --host=<ip> to expose the app on your network.\n');
  } else {
    console.log('\nWhich address will you open the app on?\n');
    console.log('  1) localhost — this machine only');
    candidates.forEach((entry, i) => {
      console.log(`  ${i + 2}) ${entry.address} — ${entry.name} (reachable from other devices)`);
    });

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('\nChoice [1]: ')).trim();
    rl.close();

    const picked = Number(answer);
    if (Number.isInteger(picked) && picked >= 2 && picked <= candidates.length + 1) {
      host = candidates[picked - 2].address;
    }
    console.log('');
  }
}

const onLan = host !== 'localhost';

// The API must accept the exact origin the browser reports, so localhost stays
// in the list even when a LAN address is added — you will still use both.
const corsOrigin = onLan
  ? `http://localhost:${WEB_PORT},http://${host}:${WEB_PORT}`
  : `http://localhost:${WEB_PORT}`;

console.log(`Configuring for http://${host}:${WEB_PORT}\n`);

// ── write the files ─────────────────────────────────────────────────
await render('packages/shared/.env.example', 'packages/shared/.env', (body) => body);

await render('apps/api/.env.example', 'apps/api/.env', (body) => {
  let out = setKey(body, 'CORS_ORIGIN', corsOrigin);
  // A shared, published signing key is not a default worth having, and the dev
  // database is reseeded anyway — so every working copy gets its own.
  out = setKey(out, 'JWT_SECRET', secret());
  out = setKey(out, 'JWT_REFRESH_SECRET', secret());
  return out;
});

await render('apps/web/.env.example', 'apps/web/.env.local', (body) =>
  setKey(body, 'NEXT_PUBLIC_API_URL', `http://${host}:${API_PORT}`),
);

// ── what to do next ─────────────────────────────────────────────────
console.log('\nNext:');
console.log('  pnpm db:push && pnpm db:seed');
console.log('  pnpm dev\n');
console.log(`  web  http://${host}:${WEB_PORT}`);
console.log(`  api  http://${host}:${API_PORT}/api/docs\n`);

if (onLan) {
  console.log('Opening this up to the network also needs the port allowed through');
  console.log('the firewall. On Windows, in an elevated PowerShell:\n');
  console.log('  New-NetFirewallRule -DisplayName "SIMULYN dev" -Direction Inbound `');
  console.log(`    -Protocol TCP -LocalPort ${WEB_PORT},${API_PORT} -Action Allow -Profile Private\n`);
  console.log('A VPN client can also block LAN traffic — allow local network if one is on.\n');
}

console.log('Deployment is separate: docker-compose and scripts/deploy.sh read the');
console.log('repo-root .env, which needs POSTGRES_* too. Copy .env.example for that.\n');
