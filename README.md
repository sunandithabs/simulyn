# SIMULYN

SIMULYN is a lab platform for teaching programming and electronics. Students write code
that real compilers run and grade, solve circuit problems, step through their own program
as it executes, and sit timed exams that a teacher can watch live.

Grading is deterministic. Compilers and interpreters run the code, and a structural output
comparison decides the verdict. No AI is involved in scoring. The AI mentor is a separate,
optional hint feature, and `pnpm --filter api test:no-ai` checks that the two stay apart.

## Contents

[Features](#features) · [Architecture](#architecture) · [Tech stack](#tech-stack) ·
[Prerequisites](#prerequisites) · [Quick start](#quick-start) ·
[Environment variables](#environment-variables) · [Project structure](#project-structure) ·
[How it works](#how-it-works) · [API overview](#api-overview) · [Commands](#commands) ·
[Tests](#tests) · [Deployment](#deployment) · [Contributing](#contributing)

---

## Features

### Students

| Area | Details |
|---|---|
| Problem bank | 10 seeded programming problems (arrays, strings, two pointers, hash tables, stacks, linked lists, trees, graphs, DP, backtracking) and 5 electronics problems (DC circuits, diodes, transients, amplifiers, filters). You can filter by difficulty and category |
| Code editor | Monaco, self-hosted, for Python 3, JavaScript, C++17 and Java 17. Drafts autosave per problem and language, with a "Draft saved" indicator. `Ctrl/⌘+Enter` runs, `Ctrl/⌘+Shift+Enter` submits, `Ctrl/⌘+Shift+F` formats |
| Run and Submit | Run checks the visible sample cases. Submit also runs the hidden cases and records a scored submission. A hidden case returns pass or fail and nothing else: no input, expected output, stdout, stderr or exit code |
| Custom input | The Input box runs your solution on whatever you type (one JSON value per line, in parameter order). Output appears in the Console tab |
| Error lines | Compile errors and sample-case crashes are underlined on the student's own line, with the message on hover |
| Format code | A whitespace-only formatter that re-indents by brace depth and tidies blank lines and line endings. It never changes a token, and it edits through Monaco's undo stack, so Undo works |
| Switch guard | Switching language or resetting asks for confirmation. The current draft is saved first |
| Visualiser | Replays your own run in a side drawer. See [Visualiser](#visualiser) |
| Electronics | Numeric answers checked within a tolerance, with a schematic and waveform drawn from the problem's parameters |
| AI mentor (optional) | Socratic hints from a local Ollama model, or from Anthropic or OpenAI as a fallback. Replies are cached by code hash |
| Progress | XP, levels and streaks; six badges (First Blood, Week Warrior, Habit Forged, Top Ten, Flawless, Category Master); a global and per-class leaderboard; an activity heatmap and skill radar on the profile |
| Discussions | A thread on each problem, with replies and upvotes |
| Themes | Four colour themes you can switch between |

### Teachers

- Create and edit problems: a harness definition, starter code per language, and visible
  and hidden test cases. Electronics problems take questions with an answer and a tolerance.
- Create classes with a join code, enrol or remove students, and assign problems.
- Schedule timed exams, then review results and each attempt's timeline.
- Watch an exam live. The proctor board streams violations over Socket.IO with an
  integrity score per student, and a proctor can flag, remove (with a reason) or readmit
  a student. See [Proctoring rules](#proctoring-rules).
- See class and per-problem performance and per-student breakdowns. An optional
  AI-written classroom summary is available at `POST /analytics/classroom-insights`.

### Admins

- Manage users, including bulk import of a whole cohort from CSV.
- View the class and system overviews, and a health check that lists which language
  runtimes the host can run.
- Read the live configuration on a settings page, with secrets masked.

### Research study (optional)

A consent screen and an exit survey for classroom evaluation. Participants consent once,
and teachers and admins can export the study data as CSV (dates in ISO-8601 UTC). If the
study endpoints are unreachable the consent screen is skipped, so it can't lock anyone out.

---

## Architecture

```
 Browser (Next.js 15 / React 19)
   │  REST + JWT                          Socket.IO /proctoring (JWT on handshake)
   ▼                                              ▲
 NestJS 11 API ───────────────────────────────────┘
   ├─ auth · users · classes · problems · submissions · exams
   ├─ proctoring · gamification · discussions · analytics · admin · research
   ├─ mentor ──► Ollama / Anthropic / OpenAI        (hints and summaries only)
   └─ execution ─► generated driver ─► python3 | node | g++ | javac+java
         │                              (child process, env-scrubbed, timed)
         ▼
   Prisma 6 ─► SQLite (dev) · PostgreSQL (prod)
```

Grading runs through `submissions → execution → compare`, and none of those import `mentor`.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | `apps/api`, `apps/web`, `packages/shared` |
| Backend | NestJS 11 (TypeScript) | REST + Socket.IO, Swagger at `/api/docs` |
| Frontend | Next.js 15 (App Router) | React 19, Tailwind CSS v4, canvas-based visualiser |
| Database | Prisma 6: SQLite in dev, PostgreSQL in production | one schema; the production schema is derived from it |
| Auth | JWT access token (15 min) and a rotating refresh cookie (7 days) | refresh tokens are stored hashed; the access token lives in memory only |
| Editor | Monaco, self-hosted | no CDN, so it works without outbound internet |
| Realtime | Socket.IO namespace `/proctoring` | JWT verified on handshake |
| AI | Ollama, with an optional Anthropic or OpenAI fallback | hints and summaries only |
| Rate limiting | `@nestjs/throttler`, per user | 300 requests/min overall; `/execute/*` is limited to 30/min |

---

## Prerequisites

- Node 20+ and pnpm 9+ (`npm i -g pnpm`).
- Python 3 and Node on `PATH`, to run student submissions.
- g++ and JDK 17 (`javac` and `java`). These are optional locally and are included in the
  Docker image. If one is missing, the API logs it at startup and that language returns
  a toolchain error.
- Ollama, optional. Without it the AI mentor shows a plain message instead of a hint.
- Docker and Compose, for deployment only.

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

`pnpm setup:env` writes the three gitignored env files a working copy needs:
`packages/shared/.env`, `apps/api/.env` and `apps/web/.env.local`. (Prisma resolves
`DATABASE_URL` relative to the schema, so it never reads the repo-root `.env`.) Each file
is rendered from its committed `.env.example`. Every clone gets its own JWT signing keys,
and existing files are never overwritten unless you pass `--force`.

The script can also bind the app to a LAN address so other devices can reach it. Two
settings have to agree for that to work: `NEXT_PUBLIC_API_URL` tells the browser where the
API is, and the API's `CORS_ORIGIN` must list the exact origin the browser reports. The
script keeps them in step:

```bash
pnpm setup:env --host=192.168.0.7   # skip the prompt
pnpm setup:env --localhost          # this machine only
```

Both values are read once at startup. `NEXT_PUBLIC_API_URL` is inlined at build time, and
`nest start --watch` doesn't watch `.env`, so restart `pnpm dev` after changing either.
Other devices also need the two ports opened in your firewall, and the script prints the
rule for that.

Deployment uses a different file. `docker-compose` and `scripts/deploy.sh` read the
repo-root `.env`, which also needs the `POSTGRES_*` values. Copy `.env.example` for that.

### Seed data

`pnpm db:seed` creates a demo class with every seeded problem assigned, plus sample admin,
teacher and student accounts. The credentials are defined in
`packages/shared/prisma/seed.ts`, so change them there before any shared or hosted use.
Seeded students have `mustChangePassword: true` and are asked for a new password on first
sign-in. For a demo you can set that to `false` in the seed file and re-seed.

### Demo data

`pnpm db:seed` wipes the database, so don't run it once real users exist. To fill the
dashboards without touching anything real, use the demo-data script instead:

```bash
pnpm db:demo                  # add 40 demo students and about two months of activity
pnpm db:demo --students=80    # more students (also: --days, --class=CODE, --no-upcoming, --seed)
pnpm db:demo --reset          # remove the old demo data, then generate fresh data
pnpm db:demo:remove           # remove all demo data
```

It enrols the demo students in your existing classes, so teacher and class analytics show
real and demo activity together. It adds submissions with test results, exams with
attempts and proctoring violations, discussion threads, mentor requests, XP, streaks and
badges. It never deletes or edits existing rows. Every row it creates has an id starting
with `demo_`, which is how `--remove` finds exactly what it added. Demo students have
random passwords nobody knows, so they can't sign in. Research consent and survey rows
are never generated, so demo data can't end up in a study export.

On the server, run it the same way as the seed:
`docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @simulyn/shared db:demo`.

---

## Environment variables

`pnpm setup:env` writes these files for you. Use the tables below when you change a value
by hand. The file a variable lives in matters, because no single `.env` feeds everything:

| File | Read by | Carries |
|---|---|---|
| `packages/shared/.env` | Prisma CLI | `DATABASE_URL`, resolved relative to the schema. The repo-root `.env` is never consulted |
| `apps/api/.env` | the API | its own `DATABASE_URL`, the `JWT_*` keys, `PORT`, `CORS_ORIGIN`, `NODE_ENV`, and any `EXEC_*` / `OLLAMA_*` / `CLOUD_LLM_*` override. Takes precedence over the repo-root `.env` |
| `apps/web/.env.local` | Next.js | `NEXT_PUBLIC_API_URL` |
| `.env` (repo root) | `docker-compose`, `deploy.sh` | deployment only: `POSTGRES_*` and the production overrides |

`DATABASE_URL` has to be set in both of the first two files, since Prisma reads one and
the running API reads the other. Anything you leave out falls back to the defaults below,
so a missing key is usually fine.

All four are gitignored; each has a committed `.env.example` beside it.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite path resolves against `packages/shared/prisma/` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | none | Signing keys. Change both for production |
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
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | none | Docker only |

An admin can see the live values at `/admin/settings`, with secrets masked.

---

## Project structure

```
simulyn/
├── apps/
│   ├── api/                 NestJS backend
│   │   ├── src/modules/     auth · users · classes · problems · execution ·
│   │   │                    submissions · exams · proctoring · gamification ·
│   │   │                    mentor · analytics · discussions · research · admin
│   │   │   └─ execution/    executor · harness (drivers + tracers) ·
│   │   │                    instrument (C++/Java line tracing) · compare ·
│   │   │                    error-line (maps errors to student lines)
│   │   ├── src/common/      guards, decorators, filters, interceptors, DTOs
│   │   └── test/            smoke suites (live server) + no-ai-in-grading
│   └── web/                 Next.js frontend
│       ├── src/app/         landing · login · signup · student/* · teacher/* · admin/*
│       ├── src/components/  problem (editor, results, mentor) · visualizer ·
│       │                    charts · discussion · research · ui primitives
│       ├── src/lib/         api client, socket, themes, format-code
│       ├── src/hooks/       useAuth, useProctoring, useTheme
│       └── test/            unit tests (node:test)
├── packages/shared/
│   ├── prisma/              schema, migrations, seed, derived postgres schema
│   ├── scripts/             postgres schema + migration generators
│   └── src/                 constants (languages, roles, violations, badges), types
└── scripts/
    ├── setup-env.mjs        writes the gitignored .env files
    └── deploy.sh            build, migrate and restart the containers
```

---

## How it works

### Code execution and grading

`POST /execute/run` runs a file exactly as written. `POST /submissions` wraps the student's
function in a generated driver (one per language) and grades it in five steps:

1. Wrap. The driver reads each test case from stdin, calls the function, and prints the
   result after an internal marker, so a stray `print()` can't corrupt grading. Input is
   one JSON literal per line, in parameter order. The supported parameter types are `int`,
   `double`, `string`, `bool`, `intArray`, `stringArray`, `listNode`, `treeNode` and `grid`.
   Linked lists arrive as arrays, and trees as level-order arrays with `null` for gaps.
2. Build. C++ and Java are compiled once per submission and then run once per test case.
3. Run. Each run is a child process in its own process group, with a scrubbed
   environment, a wall-clock timeout (`EXEC_TIMEOUT_MS`), capped output and a code-length
   limit. A counting semaphore (`EXEC_MAX_CONCURRENCY`) queues the overflow, and a timeout
   kills the whole process group.
4. Compare. `compare.ts` parses both sides as JSON and compares them structurally, so
   `[0,1]` equals `[0, 1]`. Numbers use a relative tolerance of 1e-6. A problem can set
   `normalize: sortArray | sortRows` when order doesn't matter. Output that isn't JSON is
   compared as trimmed strings.
5. Verdict. Each case gets `AC` (accepted), `WA` (wrong answer), `RE` (runtime error),
   `TLE` (timed out) or `NO_OUTPUT` (the driver never returned). The score is
   `round(passed / total × points)`.

Hidden cases are masked before they reach a student (`maskHiddenOutcome`), and only the
verdict and timing survive. Anything else that came back, such as stdout, an exception
message or an exit code, would let a student read the case.

Submissions run as child processes, not in a kernel sandbox. Run the API in its container,
where the limits in `docker-compose.prod.yml` (`mem_limit`, `pids_limit`) apply.

### Visualiser

The activity icon in the editor toolbar opens a drawer that replays the student's own run
on a sample case. Run fetches a trace alongside the grade, and a failed trace never blocks
the grade.

`POST /execute/trace` runs one visible case through a driver that reports its own steps.
Hidden cases can't be traced, because replaying one would reveal its input a step at a
time. Each step is one JSON line prefixed with `__SIMULYN_TRACE__`, which is stripped from
the student's own stdout:

```jsonc
{ "step": 12, "op": "compare", "vars": { "i": 2, "nums": [3,1,2] },
  "highlights": [2], "description": "if nums[i] > nums[i+1]:",
  "line": 4, "fn": "bubbleSort", "depth": 1 }
```

| Language | Trace source | Fidelity |
|---|---|---|
| Python | `sys.settrace`, which reports every line with its locals | `full` |
| C++ / Java | The source gets a step call after each statement and is compiled. If that build fails, the plain driver runs instead, so the student sees their own compile error | `full`, otherwise `manual` |
| JavaScript | Array reads and writes are caught through a `Proxy`, and the line comes from the call stack | `partial` |

In the drawer:

- The line being executed is highlighted in the editor and follows the step. On wide
  screens the drawer docks beside the editor, so both stay visible.
- The renderer is picked from the problem's category or parameter types: array, characters,
  stack, linked list, tree, DP table or grid, and a circuit with a waveform for electronics.
- The call stack lists the innermost call first, with its line and locals. On recursive
  tree problems the tree view draws the whole tree and lights the node the current call is
  on.
- The variable inspector flashes any value that changed since the previous step.
- Playback has play and pause, 0.5× to 4× speed, a scrubber, and previous and next step.
  `[` and `]` jump to the previous or next step where a variable changed, and the arrow
  keys step one at a time.
- A case picker lets you trace any visible case, not only the first.
- A trace returns up to 5,000 steps per request. "Load the next 5000 steps" fetches the
  next page through `offset`, and the driver skips the earlier steps without emitting them.
  Each page re-runs the code the trace started from, so the pages line up.
- If you edit the code after tracing, a notice says the trace is out of date.

### Proctoring rules

The clipboard is limited to the exam rather than disabled. Copying inside the paper is
allowed and never logged, since lifting a test case from the problem brief into the editor
is normal work. Every in-exam copy registers its text as pasteable. A paste whose contents
weren't copied inside the exam is cancelled and recorded as a `PASTE` violation. The
comparison happens entirely in the browser (`useProctoring.ts`), which keeps the last 25
copies, and nothing from the clipboard is sent to the server.

Ten violations remove the student from the exam. `FLAG_THRESHOLD` in
`packages/shared/src/constants/violation-types.ts` holds that number for both the API and
the web app. When a student crosses it, the attempt is scored and closed, `terminated` is
set, and `student-terminated` is pushed to that student's own socket room and to the
proctor room. The student can't restart, submit or record further violations.

A proctor can remove a student the same way from the live board by giving a reason, and
can readmit anyone they removed. Readmission reopens the attempt against its original
deadline, with no extra time, and resets the threshold through `violationBaseline`. Past
violations stay on record but no longer count toward another removal. Both actions are
written to the attempt's timeline as `MANUAL` entries.

---

## API overview

Every route except sign-in, sign-up and refresh needs a bearer token. Swagger docs are at
`/api/docs`. Paginated routes cap `limit` at 100.

| Module | Routes |
|---|---|
| `auth` | `POST /auth/{login,register,refresh,logout,change-password}`, `GET /auth/me`, `POST /auth/impersonate/:userId` (admin). `register` always creates a STUDENT |
| `users` | `GET/POST /users`, `GET /users/lookup`, `GET /users/:id`, `GET /users/:id/stats`, `POST /users/bulk`, `PATCH/DELETE /users/:id` |
| `classes` | CRUD, `POST /classes/join`, `POST /classes/:id/enroll`, `GET /classes/:id/students`, `DELETE /classes/:id/students/:userId` |
| `problems` | CRUD on `/problems`; assign via `/classes/:classId/problems` |
| `execution` | `POST /execute/run` · `POST /execute/submit` · `POST /execute/trace` · `GET /execute/health` (teacher/admin) · `POST /electronics/submit` |
| `submissions` | `POST /submissions`, list/inspect, per-problem history |
| `exams` | CRUD, `POST /exams/:id/start`, `POST /exams/:id/submit`, `GET /exams/:id/results`, `GET /exams/:id/attempts/:attemptId` |
| `proctoring` | `POST/GET /proctoring/violations`, `GET /proctoring/exams/:examId/live`, `POST /proctoring/attempts/:id/{flag,terminate,readmit}`, `GET …/notes` |
| `gamification` | `GET /gamification/me`, `/leaderboard`, `/badges` |
| `discussions` | `GET/POST /problems/:id/discussions`, `PATCH/DELETE /discussions/:id`, `POST /discussions/:id/upvote` |
| `mentor` | `POST /mentor/hint`, `GET /mentor/status` |
| `analytics` | `GET /analytics/class/:id`, `…/students`, `/problem/:id`, `POST /analytics/classroom-insights` |
| `research` | `GET /research/status`, `POST /research/{consent,survey,export}` |
| `admin` | `GET /admin/{overview,health,settings}` |

---

## Commands

```bash
pnpm setup:env              # write the gitignored .env files (see Quick start)
pnpm dev                    # api :3001 and web :3000, both watching
pnpm build                  # build all packages
pnpm lint                   # typecheck everything

pnpm db:push                # sync schema without a migration (dev)
pnpm db:seed                # wipe and repopulate demo data (destroys real data)
pnpm db:demo                # add demo activity without touching real data
pnpm db:studio              # browse the database
pnpm db:generate            # regenerate the Prisma client
```

### Tests

```bash
pnpm --filter web test              # 37 frontend unit tests (node:test)
pnpm --filter api test:no-ai        # grading path imports no AI or network code (offline)

pnpm --filter api test:smoke        #  96 REST, auth, execution and grading checks
pnpm --filter api test:phase5       #  59 discussions, teacher tooling, exams, proctoring
pnpm --filter api test:features     #  23 hints, badges, streaks, violation thresholds
pnpm --filter api test:termination  #  30 exam removal, readmission and authorisation
pnpm --filter api test:leak         #  16 checks that hidden test cases never leak
```

The frontend tests cover the display heuristic, the signal-trace drawing, Monaco's
self-hosting, the code formatter (it must keep every token and give the same result when
run twice), and the call-stack and tree-path reconstruction.

The five API suites run against a live server, so start one first with `pnpm dev` (or
`node apps/api/dist/main.js` after a build). They change data and assume the seeded
fixtures, so re-seed between them:

```bash
pnpm db:seed && pnpm --filter api test:smoke
```

On Windows, a running API holds Prisma's query-engine DLL, so `pnpm build`, `pnpm lint` and
`db:generate` fail with `EPERM: operation not permitted, rename
…query_engine-windows.dll.node`. Stop the dev server and run the command again.

---

## Deployment

The stack runs as three containers: `web`, `api` and `db` (PostgreSQL). The API image
includes Python, Node, g++ and JDK 17, so all four languages run in production even if
the host has none of them installed.

```bash
git clone <repo> simulyn && cd simulyn
cp .env.example .env        # fill in POSTGRES_*, JWT_*, CORS_ORIGIN, NEXT_PUBLIC_API_URL
./scripts/deploy.sh --seed  # --seed only on a fresh install
```

Subsequent deploys:

```bash
./scripts/deploy.sh         # pull, build, migrate, restart
```

`deploy.sh` refuses to run with an incomplete `.env`. It applies migrations in a throwaway
container, so a failed migration never leaves a half-started API, and then waits for the
health checks to pass.

### Schema changes

`packages/shared/prisma/schema.prisma` is the source of truth and has to stay
SQLite-compatible, so no `@db.Text` and no native arrays (JSON is stored as strings).
`prisma/postgres/schema.prisma` is derived from it and should never be edited by hand.

In development, apply a schema edit straight to SQLite:

```bash
pnpm db:push && pnpm db:seed
```

Both migration sets are committed, and production runs `db:postgres:deploy`, so a schema
change needs a migration in each. The generators only write the `0_init` baseline. They
diff `--from-empty` and skip a directory that already exists. To make an incremental
migration, diff the previous schema against the new one:

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

Read both files before you commit. SQLite has no `ALTER TABLE … ADD CONSTRAINT`, so Prisma
writes most changes there as a table rebuild, while PostgreSQL gets a plain `ALTER TABLE`.

Neither migrations directory has a `migration_lock.toml`, because the custom generators
don't write one. That's why the diff above uses `--from-schema-datamodel` instead of the
usual `--from-migrations`, which fails with "Could not determine the connector from the
migrations directory".

---

## Contributing

- Follow the existing patterns. The backend uses the global `JwtAuthGuard` with
  `@Public()`, `@Roles()` and `@CurrentUser()`. The frontend uses the `api` client,
  `useAuth` and the `ui/` primitives. Reuse them instead of adding parallel versions.
- The global `ValidationPipe` runs with `whitelist: true`, so a DTO property without a
  class-validator decorator is silently stripped. Free-form values need `@IsDefined()`.
- Pagination caps `limit` at 100, so the client should never ask for more.
- Design tokens live in `apps/web/src/app/globals.css`. Use the named colours (`ink`,
  `violet`, `brass`, `paper`, `trace`, `fault`) instead of new hex values, along with the
  `.glass`, `.instrument` and `.hairline` utilities.
- Anything both the API and the web app need goes in `packages/shared`, so the two can't
  drift apart. `FLAG_THRESHOLD` and the violation catalogue live there for that reason.
- Keep grading deterministic. Nothing under `execution/`, `submissions/`, `exams/` or
  `gamification/` may import the mentor, an LLM client or the network.
- Before you call something done, run `pnpm build`, `pnpm lint`, `pnpm --filter web test`
  and `pnpm --filter api test:no-ai`. Then run the five API suites against a live server,
  re-seeding between them.
