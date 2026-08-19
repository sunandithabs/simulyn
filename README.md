# SIMULYN

Virtual engineering labs for programming and electronics education. Students write code
against real compilers, measure circuits, and sit timed exams their instructor can watch
in real time.

- **Students** solve problems in Python, JavaScript, C++ or Java against hidden test
  cases, answer tolerance-checked electronics questions, ask a Socratic AI mentor for
  hints, and earn XP, levels, streaks and badges.
- **Teachers** author problems, assign them to classes, schedule exams, and invigilate
  live — violations stream in as they happen with a per-student integrity score, and a
  proctor can remove a student from an exam or readmit one.
- **Admins** manage accounts, bulk-import a cohort from CSV, and watch system health.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | `apps/api`, `apps/web`, `packages/shared` |
| Backend | NestJS 11 (TypeScript) | REST + Socket.IO, Swagger at `/api/docs` |
| Frontend | Next.js 15 (App Router) | React 19, Tailwind CSS v4 |
| Database | Prisma 6 — SQLite in dev, PostgreSQL in production | one schema, provider derived for prod |
| Auth | JWT access (15 min) + rotating refresh cookie (7 days) | refresh tokens stored hashed |
| Editor | Monaco, self-hosted | no CDN — works with no outbound internet |
| Realtime | Socket.IO namespace `/proctoring` | JWT verified on handshake |
| AI | Ollama, optional Anthropic/OpenAI fallback | responses cached by code hash |

---

## Prerequisites

- **Node 20+** and **pnpm 9+** (`npm i -g pnpm`)
- **Python 3** and **Node** on `PATH` — needed to execute student submissions
- **g++** and **JDK 17** — optional locally, included in the Docker image
- **Ollama** — optional; the AI mentor degrades to a clear message without it
- **Docker + Compose** — for deployment only

---

## Quick start

```bash
pnpm install
pnpm setup:env
pnpm db:push && pnpm db:seed
pnpm dev
```

- Web → <http://localhost:3000>
- API → <http://localhost:3001>
- API docs → <http://localhost:3001/api/docs>

`pnpm setup:env` writes the three gitignored env files a working copy needs —
`packages/shared/.env` (Prisma resolves `DATABASE_URL` relative to the schema, so
the repo-root `.env` is never read), `apps/api/.env` and `apps/web/.env.local` —
each rendered from its committed `.env.example`. It gives every clone its own JWT
signing keys and never overwrites a file that already exists; pass `--force` to
replace them.

It also offers to bind to a LAN address so other devices on the network can reach
the app. That has to be set in two places at once — `NEXT_PUBLIC_API_URL` tells
the browser where the API is, and the API's `CORS_ORIGIN` has to list the exact
origin the browser reports — which is what the script keeps in step:

```bash
pnpm setup:env --host=192.168.0.7   # skip the prompt
pnpm setup:env --localhost          # this machine only
```

Both values are read once at startup: `NEXT_PUBLIC_API_URL` is inlined at build
time, and `nest start --watch` does not watch `.env`. Restart `pnpm dev` after
changing either. Reaching the app from another device also needs the two ports
allowed through the firewall — the script prints the rule.

> Deployment is separate: `docker-compose` and `scripts/deploy.sh` read the
> repo-root `.env`, which additionally needs `POSTGRES_*`. Copy `.env.example`
> for that.

### Demo accounts

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Teacher | `dr.sunitha` | `teacher1` |
| Students | `sunan`, `vivek`, `vahini`, `sanjan` | `student1` … `student4` |

Class **CSE 2026 Batch A**, join code `CSE2026A`, with all 15 seeded problems assigned.

Student accounts are seeded with `mustChangePassword: true`, so the first sign-in asks
for a new password. To skip that in a demo, set it to `false` in
`packages/shared/prisma/seed.ts` and re-seed.

---

## Environment variables

`pnpm setup:env` writes these; the table is the reference for changing one by hand.
Which file a variable belongs in matters — there is no single `.env` that feeds
everything:

| File | Read by | Carries |
|---|---|---|
| `packages/shared/.env` | Prisma CLI | `DATABASE_URL` — resolved relative to the schema, so the repo-root `.env` is **never** consulted |
| `apps/api/.env` | the API | its own `DATABASE_URL`, the `JWT_*` keys, `PORT`, `CORS_ORIGIN`, `NODE_ENV`, and any `EXEC_*` / `OLLAMA_*` / `CLOUD_LLM_*` override. Takes precedence over the repo-root `.env` |
| `apps/web/.env.local` | Next.js | `NEXT_PUBLIC_API_URL` |
| `.env` (repo root) | `docker-compose`, `deploy.sh` | deployment only — `POSTGRES_*` and the production overrides |

`DATABASE_URL` is needed in **both** of the first two: Prisma reads one, the running
API reads the other. Everything not listed falls back to the defaults in the table
below, so a missing key is usually fine.

All four are gitignored; each has a committed `.env.example` beside it.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite path resolves against `packages/shared/prisma/` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | — | **Change for production.** Signing keys |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` | Token lifetimes |
| `PORT` | `3001` | API port |
| `NODE_ENV` | `development` | `production` hardens the refresh cookie (`secure`, `sameSite=strict`) |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowed origins. Must contain the exact origin the browser reports |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Baked into the web build. Must agree with `CORS_ORIGIN` |
| `EXEC_MAX_CONCURRENCY` | `20` | Simultaneous executions before queuing |
| `EXEC_TIMEOUT_MS` | `8000` | Wall clock per test case |
| `PYTHON_BIN` / `CXX_BIN` / `JAVAC_BIN` / `JAVA_BIN` | auto-detected | Override toolchain paths |
| `OLLAMA_URL` / `OLLAMA_MODEL` | `localhost:11434` / `phi3` | Local model |
| `CLOUD_LLM_PROVIDER` / `CLOUD_LLM_API_KEY` / `CLOUD_LLM_MODEL` | unset | `anthropic` or `openai` fallback |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | — | Docker only |

Live values are visible to an admin at **/admin/settings** with secrets masked.

---

## Project structure

```
simulyn/
├── apps/
│   ├── api/                 NestJS backend
│   │   ├── src/modules/     auth · users · classes · problems · execution ·
│   │   │                    submissions · exams · proctoring · gamification ·
│   │   │                    mentor · analytics · discussions · admin
│   │   ├── src/common/      guards, decorators, filters, interceptors, DTOs
│   │   └── test/            smoke suites (run against a live server)
│   └── web/                 Next.js frontend
│       ├── src/app/         landing · login · student/* · teacher/* · admin/*
│       ├── src/components/  ui primitives, problem solver, charts, discussion
│       ├── src/hooks/       useAuth, useProctoring
│       └── test/            unit tests (node:test)
├── packages/shared/
│   ├── prisma/              schema, migrations, seed, derived postgres schema
│   ├── scripts/             postgres schema + migration generators
│   └── src/                 constants, types, JSON helpers
└── scripts/
    ├── setup-env.mjs        writes the gitignored .env files
    └── deploy.sh            build, migrate and restart the containers
```

### How code execution works

`POST /execute/run` runs a file as written. `POST /submissions` wraps the student's
function in a generated driver — one per language — that parses each test case from
stdin, calls the function, and prints the result after an internal marker so debug
`print()` calls never corrupt grading. Test input is **one JSON literal per line** in
parameter order; expected output is a single JSON literal. Supported parameter types:
`int`, `double`, `string`, `bool`, `intArray`, `stringArray`, `listNode`, `treeNode`,
`grid`.

Compiled languages are compiled once per submission and run per test case. A counting
semaphore caps concurrency; every run has a wall-clock timeout, truncated output and a
code-length limit.

> **Isolation:** submissions run as child processes, not in a kernel sandbox. Run the API
> in its container (below), which is what the resource limits in
> `docker-compose.prod.yml` are for.

### Proctoring rules

**The clipboard is scoped to the exam, not disabled.** Copying inside the paper is free
and never logged — lifting a test case out of the problem brief into the editor is normal
work. Every in-exam copy registers its text as pasteable; a paste whose contents were not
copied inside the exam is cancelled and recorded as a `PASTE` violation. The comparison
lives entirely in the browser (`useProctoring.ts`), holds the last 25 copies, and nothing
from the clipboard is ever sent to the server.

**Ten violations remove the student from the exam.** `FLAG_THRESHOLD` in
`packages/shared/src/constants/violation-types.ts` is the single source of truth for both
the API and the web app. Crossing it scores and closes the attempt, sets `terminated`, and
pushes `student-terminated` to that student's own socket room and the proctor room. The
student cannot restart, submit, or record further violations.

A proctor can do the same deliberately from the live board with a stated reason, and can
readmit anyone they removed. Readmission reopens the attempt against its **original**
deadline — no extra time — and re-bases the threshold via `violationBaseline`, so past
violations stay on record but stop counting towards another removal. Both actions are
written onto the attempt's timeline as `MANUAL` entries.

---

## Commands

```bash
pnpm setup:env              # write the gitignored .env files (see Quick start)
pnpm dev                    # api :3001 and web :3000, both watching
pnpm build                  # build all packages
pnpm lint                   # typecheck everything

pnpm db:push                # sync schema without a migration (dev)
pnpm db:seed                # wipe and repopulate demo data
pnpm db:studio              # browse the database
pnpm db:generate            # regenerate the Prisma client
```

### Tests

```bash
pnpm --filter web test              # 23 frontend unit tests (node:test)

pnpm --filter api test:smoke        #  96 REST, auth, execution and grading checks
pnpm --filter api test:phase5       #  59 discussions, teacher tooling, exams, proctoring
pnpm --filter api test:features     #  23 hints, badges, streaks, violation thresholds
pnpm --filter api test:termination  #  30 exam removal, readmission and authorisation
pnpm --filter api test:leak         #  16 checks that hidden test cases never leak
```

The five API suites run against a **live server** — start one with `pnpm dev` (or
`node apps/api/dist/main.js` after a build) first. They mutate data and assume the
seeded fixtures, so re-seed between them:

```bash
pnpm db:seed && pnpm --filter api test:smoke
```

> On Windows a running API holds Prisma's query-engine DLL, so `pnpm build`,
> `pnpm lint` and `db:generate` fail with `EPERM: operation not permitted, rename
> …query_engine-windows.dll.node`. Stop the dev server and re-run.

---

## Deployment

The stack is three containers: `web`, `api` and `db` (PostgreSQL). The API image ships
Python, Node, g++ and JDK 17, so all four languages execute in production even if the
host has none of them.

```bash
git clone <repo> simulyn && cd simulyn
cp .env.example .env        # fill in POSTGRES_*, JWT_*, CORS_ORIGIN, NEXT_PUBLIC_API_URL
./scripts/deploy.sh --seed  # --seed only on a fresh install
```

Subsequent deploys:

```bash
./scripts/deploy.sh         # pull, build, migrate, restart
```

`deploy.sh` refuses to run with an incomplete `.env`, applies migrations in a throwaway
container so a failure never leaves a half-started API, and waits for health checks.

### Schema changes

`packages/shared/prisma/schema.prisma` is the single source of truth and stays
SQLite-compatible — no `@db.Text`, no native arrays (JSON is stored as strings).
`prisma/postgres/schema.prisma` is **derived** from it, never hand-edited.

In development, apply a schema edit straight to SQLite:

```bash
pnpm db:push && pnpm db:seed
```

Both migration sets are committed and production runs `db:postgres:deploy`, so a
schema change also needs a migration in each. The generators only ever write the
`0_init` baseline — they diff `--from-empty` and skip a directory that already
exists — so an **incremental** migration is produced by diffing the previous schema
against the new one:

```bash
pnpm --filter @simulyn/shared db:postgres:schema     # re-derive the pg schema first

cd packages/shared
NAME=20260815_attempt_termination
mkdir -p prisma/migrations/$NAME prisma/postgres/migrations/$NAME

git show HEAD:packages/shared/prisma/schema.prisma > /tmp/old.prisma
pnpm exec prisma migrate diff --from-schema-datamodel /tmp/old.prisma \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/$NAME/migration.sql

git show HEAD:packages/shared/prisma/postgres/schema.prisma > /tmp/old-pg.prisma
pnpm exec prisma migrate diff --from-schema-datamodel /tmp/old-pg.prisma \
  --to-schema-datamodel prisma/postgres/schema.prisma --script \
  > prisma/postgres/migrations/$NAME/migration.sql
```

Read both files before committing — SQLite has no `ALTER TABLE … ADD CONSTRAINT`, so
Prisma renders most changes as a table rebuild, while PostgreSQL gets a plain
`ALTER TABLE`.

> Neither migrations directory has a `migration_lock.toml`, because the custom
> generators do not write one. That is why the diff above goes through
> `--from-schema-datamodel` rather than the usual `--from-migrations`, which fails
> with *"Could not determine the connector from the migrations directory"*.

---

## Contributing

- **Match the surrounding code.** The backend leans on the global `JwtAuthGuard` with
  `@Public()`, `@Roles()` and `@CurrentUser()`; the frontend on the `api` client,
  `useAuth`, and the `ui/` primitives. Reuse them rather than adding parallel ones.
- **The global `ValidationPipe` runs with `whitelist: true`** — a DTO property with no
  class-validator decorator is silently stripped. Free-form values need `@IsDefined()`.
- **Pagination caps `limit` at 100.** Never request more from the client.
- **Design tokens live in `apps/web/src/app/globals.css`.** Use the named colours
  (`ink`, `violet`, `brass`, `paper`, `trace`, `fault`) rather than new hex values, and
  the `.glass`, `.instrument` and `.hairline` utilities.
- **A value both sides need belongs in `packages/shared`,** not in two files that
  drift. `FLAG_THRESHOLD` and the violation catalogue are shared for exactly this
  reason.
- **Verify before claiming done:** `pnpm build`, `pnpm lint`, `pnpm --filter web test`,
  and the five API suites against a running server, re-seeding between them.
