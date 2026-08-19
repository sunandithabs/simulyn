# SIMULYN — Master Build Prompt for Claude

> **How to use this**: Copy-paste one phase at a time into a Claude conversation. Each phase is self-contained. Start a **new conversation** for each phase if context gets too long. Each phase ends with verification steps — confirm they pass before moving to the next phase.

---

## Phase 1: Monorepo Scaffold + Database Schema + Prisma Setup

```
You are building a production-grade educational platform called SIMULYN — a virtual engineering labs platform for programming & electronics education. This is Phase 1: setting up the monorepo, database schema, and Prisma ORM.

## Tech Stack (locked in — do not change)
- Monorepo: Turborepo
- Backend: NestJS (TypeScript)
- Frontend: Next.js 14+ (App Router, React, TypeScript)
- ORM: Prisma
- Database: SQLite for local dev, PostgreSQL for production
- Package manager: pnpm

## Task: Create the monorepo scaffold

### Step 1: Initialize the Turborepo monorepo
Create a Turborepo monorepo in the current directory with pnpm workspaces:

```
simulyn/
├── turbo.json
├── package.json              # pnpm workspace root
├── pnpm-workspace.yaml
├── .gitignore
├── .env.example
├── apps/
│   ├── api/                  # NestJS backend (create later in Phase 2)
│   └── web/                  # Next.js frontend (create later in Phase 4)
└── packages/
    └── shared/               # Shared Prisma schema, types, constants
```

### Step 2: Set up `packages/shared`
This is the shared package used by both apps/api and apps/web.

Create `packages/shared/package.json`:
- name: "@simulyn/shared"
- Include Prisma as a dependency
- Include Zod for validation schemas
- Add scripts: "db:generate", "db:migrate", "db:push", "db:seed", "db:studio"

### Step 3: Create the Prisma schema
Create `packages/shared/prisma/schema.prisma` with the COMPLETE schema below. Use EXACTLY this schema:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ── USER MANAGEMENT ──

enum Role {
  STUDENT
  TEACHER
  ADMIN
}

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  username          String    @unique
  passwordHash      String
  displayName       String
  avatar            String?
  role              Role      @default(STUDENT)
  isActive          Boolean   @default(true)
  mustChangePassword Boolean  @default(true)
  lastLoginAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  refreshTokens   RefreshToken[]
  enrollments     Enrollment[]
  taughtClasses   Class[]          @relation("ClassTeacher")
  submissions     Submission[]
  examAttempts    ExamAttempt[]
  violations      Violation[]
  gamification    Gamification?
  badges          UserBadge[]
  discussions     DiscussionPost[]
  mentorRequests  MentorRequest[]

  @@index([email])
  @@index([username])
  @@index([role])
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([token])
}

// ── CLASS & ENROLLMENT ──

model Class {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique
  description String?
  semester    String?
  teacherId   String
  teacher     User     @relation("ClassTeacher", fields: [teacherId], references: [id])
  isArchived  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  enrollments      Enrollment[]
  assignedProblems ClassProblem[]
  exams            Exam[]

  @@index([teacherId])
  @@index([code])
}

model Enrollment {
  id       String   @id @default(cuid())
  userId   String
  classId  String
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  class    Class    @relation(fields: [classId], references: [id], onDelete: Cascade)
  joinedAt DateTime @default(now())

  @@unique([userId, classId])
  @@index([classId])
}

// ── PROBLEMS & TEST CASES ──

enum ProblemType {
  PROGRAMMING
  ELECTRONICS
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

model Problem {
  id          String      @id @default(cuid())
  type        ProblemType
  difficulty  Difficulty
  category    String
  title       String
  description String
  constraints String      @default("[]")   // JSON array stored as string (SQLite compat)
  points      Int         @default(100)
  tags        String      @default("[]")   // JSON array stored as string
  isPublished Boolean     @default(false)
  createdById String
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  // Programming-specific
  starterCode String?     // JSON: { python: "...", javascript: "...", cpp: "...", java: "..." }
  harness     String?     // JSON: { funcName: {...}, params: [...], returnType: "..." }
  examples    String?     // JSON: [{ input, output, explanation }]

  // Electronics-specific
  params    String?       // JSON: { supply: 12, R1: 10000, ... }
  questions String?       // JSON: [{ id, text, answer, tolerance }]

  testCases      TestCase[]
  submissions    Submission[]
  classProblems  ClassProblem[]
  examProblems   ExamProblem[]
  discussions    DiscussionPost[]
  hints          Hint[]

  @@index([type, difficulty])
  @@index([category])
  @@index([createdById])
}

model TestCase {
  id        String  @id @default(cuid())
  problemId String
  problem   Problem @relation(fields: [problemId], references: [id], onDelete: Cascade)
  input     String
  expected  String
  isHidden  Boolean @default(false)
  order     Int     @default(0)

  @@index([problemId])
}

model Hint {
  id        String  @id @default(cuid())
  problemId String
  problem   Problem @relation(fields: [problemId], references: [id], onDelete: Cascade)
  level     Int
  text      String

  @@index([problemId])
  @@unique([problemId, level])
}

model ClassProblem {
  id         String    @id @default(cuid())
  classId    String
  problemId  String
  class      Class     @relation(fields: [classId], references: [id], onDelete: Cascade)
  problem    Problem   @relation(fields: [problemId], references: [id], onDelete: Cascade)
  dueDate    DateTime?
  assignedAt DateTime  @default(now())

  @@unique([classId, problemId])
}

// ── SUBMISSIONS ──

enum Language {
  PYTHON
  JAVASCRIPT
  CPP
  JAVA
}

enum SubmissionStatus {
  PENDING
  RUNNING
  COMPLETED
  ERROR
}

model Submission {
  id            String           @id @default(cuid())
  userId        String
  problemId     String
  examAttemptId String?
  user          User             @relation(fields: [userId], references: [id])
  problem       Problem          @relation(fields: [problemId], references: [id])
  examAttempt   ExamAttempt?     @relation(fields: [examAttemptId], references: [id])

  code          String
  language      Language
  status        SubmissionStatus @default(PENDING)
  passed        Boolean          @default(false)
  score         Int              @default(0)
  compileError  String?
  executionMs   Int?
  attemptNumber Int              @default(1)
  createdAt     DateTime         @default(now())

  testResults TestResult[]

  @@index([userId, problemId])
  @@index([userId, createdAt])
  @@index([examAttemptId])
  @@index([status])
}

model TestResult {
  id           String     @id @default(cuid())
  submissionId String
  submission   Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  input        String
  expected     String
  actual       String?
  passed       Boolean
  stderr       String?
  exitCode     Int?
  timedOut     Boolean    @default(false)
  executionMs  Int?

  @@index([submissionId])
}

// ── EXAMS & PROCTORING ──

model Exam {
  id             String   @id @default(cuid())
  classId        String
  class          Class    @relation(fields: [classId], references: [id])
  title          String
  description    String?
  durationMin    Int
  scheduledStart DateTime
  scheduledEnd   DateTime
  gracePeriodMin Int      @default(5)
  randomizeOrder Boolean  @default(true)
  isPublished    Boolean  @default(false)
  createdById    String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  problems ExamProblem[]
  attempts ExamAttempt[]

  @@index([classId])
  @@index([scheduledStart])
}

model ExamProblem {
  id        String  @id @default(cuid())
  examId    String
  problemId String
  exam      Exam    @relation(fields: [examId], references: [id], onDelete: Cascade)
  problem   Problem @relation(fields: [problemId], references: [id])
  order     Int     @default(0)
  points    Int?

  @@unique([examId, problemId])
}

model ExamAttempt {
  id             String    @id @default(cuid())
  examId         String
  userId         String
  exam           Exam      @relation(fields: [examId], references: [id])
  user           User      @relation(fields: [userId], references: [id])
  startedAt      DateTime  @default(now())
  submittedAt    DateTime?
  autoSubmitted  Boolean   @default(false)
  totalScore     Int       @default(0)
  questionOrder  String    // JSON array of shuffled problem IDs
  integrityScore Int       @default(100)

  submissions Submission[]
  violations  Violation[]

  @@unique([examId, userId])
  @@index([examId])
  @@index([userId])
}

enum ViolationType {
  COPY
  PASTE
  CUT
  RIGHTCLICK
  SELECTION
  DEVTOOLS
  TABSWITCH
  BLUR
  REFRESH
  CLOSE
  MULTIMONITOR
  FULLSCREEN
  SCREENSHOT
  MANUAL
}

model Violation {
  id            String        @id @default(cuid())
  examAttemptId String
  userId        String
  examAttempt   ExamAttempt   @relation(fields: [examAttemptId], references: [id], onDelete: Cascade)
  user          User          @relation(fields: [userId], references: [id])
  typeKey       ViolationType
  weight        Int
  codeSnapshot  String?
  timeRemaining Int?
  metadata      String?       // JSON
  createdAt     DateTime      @default(now())

  @@index([examAttemptId])
  @@index([userId])
  @@index([typeKey])
}

// ── GAMIFICATION ──

model Gamification {
  id             String    @id @default(cuid())
  userId         String    @unique
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  xp             Int       @default(0)
  level          Int       @default(1)
  currentStreak  Int       @default(0)
  longestStreak  Int       @default(0)
  lastActiveDate DateTime?
  problemsSolved Int       @default(0)
  updatedAt      DateTime  @updatedAt
}

model Badge {
  id          String      @id @default(cuid())
  key         String      @unique
  name        String
  description String
  icon        String
  condition   String      // JSON: { type: "problems_solved", threshold: 1 }
  userBadges  UserBadge[]
}

model UserBadge {
  id       String   @id @default(cuid())
  userId   String
  badgeId  String
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge    Badge    @relation(fields: [badgeId], references: [id])
  earnedAt DateTime @default(now())

  @@unique([userId, badgeId])
  @@index([userId])
}

// ── DISCUSSION ──

model DiscussionPost {
  id        String   @id @default(cuid())
  problemId String
  authorId  String
  parentId  String?
  problem   Problem  @relation(fields: [problemId], references: [id], onDelete: Cascade)
  author    User     @relation(fields: [authorId], references: [id])
  parent    DiscussionPost?  @relation("Replies", fields: [parentId], references: [id])
  content   String
  upvotes   Int      @default(0)
  isPinned  Boolean  @default(false)
  isDeleted Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  replies   DiscussionPost[] @relation("Replies")

  @@index([problemId])
  @@index([authorId])
  @@index([parentId])
}

// ── AI MENTOR ──

model MentorRequest {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  problemId String
  language  Language
  hintLevel Int
  codeHash  String
  response  String
  provider  String
  cached    Boolean  @default(false)
  latencyMs Int?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([codeHash])
}
```

IMPORTANT NOTES for SQLite compatibility:
- Do NOT use `@db.Text` — SQLite doesn't support it, String is already unlimited in SQLite
- Do NOT use native array types (`String[]`) — use JSON strings instead (parse/stringify in code)
- Enums in SQLite are stored as strings, which is fine

### Step 4: Create the database seed script
Create `packages/shared/prisma/seed.ts` that seeds:
- 1 Admin user (username: "admin", password: "admin123", role: ADMIN)
- 1 Teacher user (username: "dr.sunitha", password: "teacher1", displayName: "Dr. Sunitha K", role: TEACHER)
- 4 Student users: sunan/student1, vivek/student2, vahini/student3, sanjan/student4
- 1 Class: "CSE 2026 Batch A" with code "CSE2026A", taught by dr.sunitha, all 4 students enrolled
- 10 Programming problems (Two Sum, Valid Palindrome, Reverse Linked List, Max Depth Binary Tree, LIS, Group Anagrams, Number of Islands, Valid Parentheses, N-Queens Count, Container With Most Water) with test cases and hints
- 5 Electronics problems (Voltage Divider, LED Resistor, RC Time Constant, Op-Amp Gain, Low-Pass Filter) with questions and hints
- Badge definitions: first_solve, streak_7, streak_21, top_10, perfect_score, category_master
- Gamification records for all students with varied XP/streaks

Use bcrypt to hash all passwords. Mark admin and teacher accounts with mustChangePassword: false.

### Step 5: Create shared types and constants
Create these files in `packages/shared/src/`:

`constants/roles.ts` — Export the Role enum values
`constants/languages.ts` — Export supported languages: python, javascript, cpp, java
`constants/violation-types.ts` — Export violation type definitions with labels, weights, alert messages (copy the VIOLATION_TYPES object from the current js/db.js)
`constants/badge-definitions.ts` — Export badge definitions
`types/index.ts` — Re-export Prisma generated types
`index.ts` — Barrel export everything

### Step 6: Configure turbo.json
Set up pipeline for: build, dev, lint, test, db:generate, db:migrate, db:push, db:seed

### Step 7: Create .env.example at root
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-me-in-production"
JWT_REFRESH_SECRET="change-me-too"
OLLAMA_URL="http://localhost:11434/api/chat"
OLLAMA_MODEL="phi3"
PORT=3001
```

### Verification
After creating everything:
1. Run `pnpm install`
2. Run `pnpm db:generate` (Prisma client generation)
3. Run `pnpm db:push` (create SQLite database)
4. Run `pnpm db:seed` (seed demo data)
5. Run `pnpm db:studio` — verify all tables have data in the Prisma Studio UI

Do NOT proceed to any other phase. Only do Phase 1.
```

---

## Phase 2: NestJS Backend — Auth, Users, Classes, Problems

```
You are building SIMULYN — a production-grade educational platform. This is Phase 2: creating the NestJS backend with auth, user management, class management, and problem CRUD.

The monorepo is already set up (Phase 1) with:
- Turborepo monorepo with pnpm workspaces
- packages/shared/ — Prisma schema, types, constants
- SQLite database seeded with demo data

## Tech Stack
- NestJS with TypeScript
- Prisma ORM (client imported from @simulyn/shared)
- JWT auth (access token 15min + refresh token 7 days in httpOnly cookie)
- Passport.js (@nestjs/passport)
- bcrypt for password hashing
- class-validator + class-transformer for DTOs
- Swagger/OpenAPI auto-documentation

## Task: Create apps/api (NestJS backend)

### Step 1: Initialize NestJS
Create `apps/api/` with a new NestJS project. Use `@nestjs/cli` or set it up manually. Configure:
- TypeScript strict mode
- Path alias to @simulyn/shared
- Port from env (default 3001)
- Global validation pipe
- Global HTTP exception filter
- Swagger setup at /api/docs
- CORS enabled for http://localhost:3000

### Step 2: Prisma Module
Create `src/prisma/prisma.module.ts` and `src/prisma/prisma.service.ts`:
- Import PrismaClient from @simulyn/shared
- Implement OnModuleInit (connect) and OnModuleDestroy (disconnect)
- Export as a global module

### Step 3: Auth Module (`src/modules/auth/`)
Files: auth.module.ts, auth.controller.ts, auth.service.ts, strategies/jwt.strategy.ts, strategies/refresh.strategy.ts, dto/login.dto.ts, dto/register.dto.ts

Endpoints:
- POST /auth/login — Validate credentials with bcrypt, return { accessToken, user }. Set refreshToken as httpOnly secure cookie. Update lastLoginAt.
- POST /auth/refresh — Validate refresh token from cookie, issue new access token + rotate refresh token.
- POST /auth/logout — Clear refresh token cookie, delete token from DB.
- POST /auth/change-password — For users with mustChangePassword=true. Requires old + new password.

Guards:
- JwtAuthGuard — Validates Bearer access token on protected routes
- RolesGuard — Checks user.role against @Roles() decorator
- Create @CurrentUser() param decorator that extracts user from request

### Step 4: Users Module (`src/modules/users/`)
Files: users.module.ts, users.controller.ts, users.service.ts, dto/create-user.dto.ts, dto/update-user.dto.ts

Endpoints (all require auth):
- GET /users — List users (Admin only, with pagination + role filter)
- GET /users/:id — Get user profile (Admin, or self)
- POST /users — Create user (Admin only). Hash password with bcrypt. Set mustChangePassword=true.
- POST /users/bulk — Bulk create students from array (Admin/Teacher). Accept [{username, email, displayName, password}]. Return created count + any failures.
- PATCH /users/:id — Update user (Admin only, or self for limited fields)
- DELETE /users/:id — Soft delete (set isActive=false) (Admin only)
- GET /users/:id/stats — Get student stats: problems solved, XP, level, streak, submissions count

### Step 5: Classes Module (`src/modules/classes/`)
Endpoints:
- POST /classes — Create class (Teacher/Admin). Auto-generate a unique 6-char join code.
- GET /classes — List classes. Teachers see their classes. Students see enrolled classes. Admin sees all.
- GET /classes/:id — Class detail with enrollment count, problem count, exam count.
- PATCH /classes/:id — Update class (owner Teacher or Admin)
- POST /classes/:id/enroll — Enroll student(s) by userId array (Teacher/Admin)
- POST /classes/join — Student joins class by code
- DELETE /classes/:id/students/:userId — Remove student from class
- GET /classes/:id/students — List enrolled students with their progress stats

### Step 6: Problems Module (`src/modules/problems/`)
Endpoints:
- POST /problems — Create problem (Teacher/Admin). Accept all fields including testCases and hints as nested creates.
- GET /problems — List problems with filters: type, difficulty, category, tags. Support pagination.
- GET /problems/:id — Full problem detail. For students: exclude hidden test cases. For teachers: include everything.
- PATCH /problems/:id — Update problem (creator or Admin)
- DELETE /problems/:id — Delete problem (creator or Admin)
- POST /classes/:classId/problems — Assign problem to class (with optional dueDate)
- GET /classes/:classId/problems — List problems assigned to a class

### Step 7: Common utilities
Create in `src/common/`:
- `guards/jwt-auth.guard.ts` — JWT validation
- `guards/roles.guard.ts` — Role checking with @Roles() decorator
- `decorators/roles.decorator.ts` — @Roles(Role.TEACHER, Role.ADMIN)
- `decorators/current-user.decorator.ts` — @CurrentUser() extracts user from request
- `filters/http-exception.filter.ts` — Standard error response format
- `interceptors/logging.interceptor.ts` — Log request method, path, duration
- `dto/pagination.dto.ts` — { page, limit, sortBy, order } with defaults

### Verification
1. `pnpm --filter api dev` — Server starts without errors
2. Open http://localhost:3001/api/docs — Swagger UI shows all endpoints
3. POST /auth/login with {"username":"admin","password":"admin123"} — returns token
4. GET /users with Bearer token — returns user list
5. POST /classes with teacher token — creates a class
6. POST /problems with teacher token — creates a problem with test cases

Do NOT build the frontend, execution engine, or real-time features yet.
```

---

## Phase 3: NestJS Backend — Code Execution, Submissions, Exams, AI Mentor

```
You are building SIMULYN — a production-grade educational platform. This is Phase 3: adding code execution, submissions, exam management, proctoring, gamification, and AI mentor to the NestJS backend.

Phase 1 (monorepo + DB) and Phase 2 (auth, users, classes, problems) are complete.

## Task: Add remaining backend modules

### Step 1: Execution Module (`src/modules/execution/`)
Files: execution.module.ts, execution.service.ts, executor.ts, harness.ts, semaphore.ts

`semaphore.ts`:
- Implement a counting semaphore class with configurable max concurrency (default: 20)
- acquire() returns a Promise that resolves when a slot is available
- release() frees a slot and unblocks the next waiter

`executor.ts`:
- execute(lang, code, stdin, options) → { stdout, stderr, exitCode, timedOut, compileError }
- Supports 4 languages: python (python3), javascript (node), cpp (g++ -std=c++17), java (javac + java)
- For compiled languages (cpp, java): write code to a temp file, compile, run the binary
- Use child_process.spawn with a timeout (default 8 seconds)
- Clean up temp files after execution
- Wrap all executions with the semaphore

`harness.ts`:
- buildProgram(lang, userCode, harnessSpec, testInput) → string (complete compilable program)
- Generates a driver/main that: parses test input → calls the user's function → prints the result
- Handle types: int, string, bool, intArray, stringArray, listNode, treeNode, grid
- For each language, generate appropriate boilerplate (includes, main function, parsing logic)

Endpoints:
- POST /execute/run — Run code with optional stdin. Rate limited: 30/min per user.
  Body: { code, lang, stdin? }
  Returns: { ok, stdout, stderr, exitCode, timedOut, compileError }

- POST /execute/submit — Run code against all test cases using harness.
  Body: { code, lang, problemId }
  Fetch test cases from DB, build driver programs, run each, compare output.
  Returns: { ok, allPassed, compileError?, results: [{ input, expected, actual, passed, stderr, timedOut }] }

### Step 2: Submissions Module (`src/modules/submissions/`)
Endpoints:
- POST /submissions — Create a submission. Internally calls execution.service to run/evaluate.
  Body: { problemId, code, language, examAttemptId? }
  Flow:
    1. Create Submission record (status: PENDING)
    2. Call execution service (status: RUNNING)
    3. Save TestResult records (status: COMPLETED)
    4. Calculate score, update passed/score
    5. If all passed AND not an exam: call gamification.service to award XP
    6. Return full submission with test results

- GET /submissions — List user's submissions (with filters: problemId, language, passed)
- GET /submissions/:id — Get submission detail with all test results
- GET /problems/:id/submissions — Get all submissions for a problem (Teacher/Admin for class analytics)

### Step 3: Electronics Validation
Add to execution service:
- POST /electronics/submit
  Body: { problemId, answers: [{ questionId, value }] }
  Fetch problem's questions from DB, compare each answer with tolerance.
  Returns: { allCorrect, results: [{ questionId, expected, actual, correct, tolerance }], score }

### Step 4: Exams Module (`src/modules/exams/`)
Endpoints:
- POST /exams — Create exam (Teacher). Body: { classId, title, durationMin, scheduledStart, scheduledEnd, problemIds, randomizeOrder }
- GET /exams — List exams for user's enrolled classes (student) or taught classes (teacher)
- GET /exams/:id — Exam detail. Students only see it if within the time window.
- PATCH /exams/:id — Update exam (creator/Admin)
- DELETE /exams/:id — Delete exam
- POST /exams/:id/start — Student starts the exam.
  Creates ExamAttempt with shuffled questionOrder (if randomizeOrder=true).
  Returns: { attemptId, questions (in shuffled order, without hidden test cases), endsAt }
  Only works within scheduledStart..scheduledEnd window (+ grace period).
- POST /exams/:id/submit — Student submits the exam. Sets submittedAt, calculates totalScore.
- GET /exams/:id/results — Teacher gets all students' results for this exam.
- GET /exams/:id/attempts/:attemptId — Get attempt detail with submissions and violations.

Auto-submit logic:
- When a student starts an exam, calculate the deadline (startedAt + durationMin).
- The frontend should auto-submit when time expires.
- The backend should ALSO enforce this: any submission after the deadline is rejected.

### Step 5: Proctoring Module (`src/modules/proctoring/`)
Files: proctoring.module.ts, proctoring.gateway.ts, proctoring.service.ts, proctoring.controller.ts

REST Endpoints:
- POST /proctoring/violations — Record a violation. Decrement integrityScore on the ExamAttempt.
- GET /proctoring/violations?examId=&userId= — List violations with filters.

WebSocket Gateway (Socket.IO via @nestjs/websockets):
- Namespace: /proctoring
- Events:
  - Client → Server: "join-exam" { examId, role } — Join the exam room
  - Client → Server: "violation" { examAttemptId, typeKey, weight, codeSnapshot, timeRemaining } — Report violation
  - Client → Server: "heartbeat" { examAttemptId, currentQuestion, timeRemaining } — Student activity pulse
  - Server → Room(teacher:{examId}): "student-violation" — Real-time violation alert to teacher
  - Server → Room(teacher:{examId}): "student-heartbeat" — Student activity update
  - Server → Room(exam:{examId}): "exam-ended" — Exam time expired signal

Authentication: Validate JWT token on WebSocket connection handshake.

### Step 6: Gamification Module (`src/modules/gamification/`)
Endpoints:
- GET /gamification/me — Get current user's XP, level, streak, badges
- GET /gamification/leaderboard?classId= — Class or global leaderboard (top 50)
- GET /gamification/badges — List all available badges with earned status for current user

Service methods (called internally by submissions module):
- awardXP(userId, points) — Add XP, check level-up thresholds, update streak
- checkBadges(userId) — Check if user qualifies for new badges, award them
- Level thresholds: L1=0, L2=500, L3=1500, L4=3500, L5=6000, L6=10000, L7=15000, L8=25000

### Step 7: AI Mentor Module (`src/modules/mentor/`)
Files: mentor.module.ts, mentor.controller.ts, mentor.service.ts, ollama.client.ts, cloud-llm.client.ts

`ollama.client.ts`:
- Call local Ollama at OLLAMA_URL (default http://localhost:11434/api/chat)
- Use OLLAMA_MODEL (default "phi3")
- System prompt: "You are a Socratic programming tutor. Give hints, never complete solutions. The student is working on: {title} ({difficulty}). Their current code in {language} is shown. Hint level: {1=gentle nudge, 2=stronger hint, 3=near-solution approach}."
- Handle connection errors gracefully (return ok: false)

`cloud-llm.client.ts`:
- Optional fallback: call OpenAI or Anthropic API if configured via CLOUD_LLM_PROVIDER, CLOUD_LLM_API_KEY env vars
- Same system prompt as Ollama

Endpoint:
- POST /mentor/hint — Body: { problemId, language, hintLevel, code }
  1. Hash the code + problemId + hintLevel for cache key
  2. Check MentorRequest table for cached response
  3. If miss: call Ollama (or cloud fallback)
  4. Save response to MentorRequest table
  5. Return: { text, hintLevel, provider, cached }
  Rate limit: 10/min per user.

### Step 8: Analytics Module (`src/modules/analytics/`)
Endpoints (Teacher/Admin only):
- GET /analytics/class/:classId — Class overview: avg accuracy, total submissions, active students, weakest categories
- GET /analytics/class/:classId/students — Per-student breakdown: problems solved, avg score, violations, XP
- GET /analytics/problem/:problemId — Problem stats: pass rate, avg attempts, common errors
- POST /analytics/classroom-insights — Send aggregated stats to AI for classroom-level recommendations (uses mentor service)

### Verification
1. POST /execute/run with Python code — returns real stdout
2. POST /submissions with a Two Sum solution — runs against test cases, returns results
3. POST /electronics/submit with correct answers — returns allCorrect: true
4. POST /exams/{id}/start — creates ExamAttempt with shuffled order
5. WebSocket connection to /proctoring — can join exam room and receive violation events
6. POST /mentor/hint — returns AI hint (or graceful error if Ollama is not running)
7. GET /gamification/leaderboard — returns ranked students

Do NOT build the frontend yet.
```

---

## Phase 4: Next.js Frontend — Layout, Auth, Student Dashboard

```
You are building SIMULYN — a production-grade educational platform. This is Phase 4: creating the Next.js frontend with auth flow, layout shell, and the student dashboard.

Phase 1-3 (monorepo, database, full NestJS backend) are complete. The API runs on port 3001.

## Tech Stack
- Next.js 14+ with App Router (TypeScript)
- Tailwind CSS v4
- shadcn/ui components
- Monaco Editor (@monaco-editor/react)
- Socket.IO client
- Fonts: Inter (body), JetBrains Mono (code)

## Design Requirements
- Dark theme by default (deep navy/purple background, NOT pure black)
- Glassmorphism cards (backdrop-blur, translucent borders)
- Color palette: Purple (#7352b8 → #a78bfa) primary, Gold (#c7a346 → #e8cc80) accent, dark bg (#0a0a14)
- Smooth micro-animations on all interactive elements
- Premium, polished feel — NOT a generic Bootstrap look

## Task: Create apps/web (Next.js frontend)

### Step 1: Initialize Next.js
Create `apps/web/` with Next.js 14+ (App Router, TypeScript, Tailwind CSS, src/ directory).
Install: shadcn/ui, @monaco-editor/react, socket.io-client, lucide-react (icons), framer-motion (animations)
Configure path alias to @simulyn/shared.
Set up Tailwind with custom theme colors matching the palette above.

### Step 2: API Client
Create `src/lib/api.ts`:
- Typed fetch wrapper that auto-attaches Authorization header from cookie/localStorage
- Auto-refreshes access token on 401 using /auth/refresh
- Base URL from NEXT_PUBLIC_API_URL env var (default http://localhost:3001)
- Helper functions: api.get<T>(), api.post<T>(), api.patch<T>(), api.delete<T>()

Create `src/lib/socket.ts`:
- Socket.IO client factory, connects to API_URL/proctoring namespace
- Passes auth token in handshake

### Step 3: Auth Flow
Create `src/hooks/useAuth.ts`:
- Manages auth state: user, loading, login(), logout(), refreshToken()
- Store accessToken in memory (NOT localStorage for security), refreshToken handled by httpOnly cookie
- Provide via React Context

Create pages:
- `src/app/page.tsx` — Landing page. Premium dark hero section with the SIMULYN branding. "Enter Workspace" button → login page. Animated background (CSS gradient animation, floating orbs). Show feature pills: "Python & C++ Labs", "Circuit Simulation", "AI Mentor", "Live Proctoring".

- `src/app/login/page.tsx` — Login page with role toggle (Student / Teacher / Admin). Username + password form. Demo account quick-login chips (same as current app: Sunan, Sanjan, Dr. Sunitha). Error handling. Redirect to /student, /teacher, or /admin based on role after login. If mustChangePassword, redirect to /change-password.

### Step 4: Layout Shells
Create role-specific layouts with sidebars:

`src/app/student/layout.tsx` — Student shell:
- Collapsible sidebar with: Dashboard, Problems, Exams, Leaderboard, Profile
- Top navbar with: user avatar, XP bar, streak counter, logout
- Glassmorphism sidebar styling

`src/app/teacher/layout.tsx` — Teacher shell:
- Sidebar: Dashboard, Classes, Problems, Exams, Analytics
- Top navbar with: user info, logout

`src/app/admin/layout.tsx` — Admin shell:
- Sidebar: Dashboard, Users, Settings

### Step 5: Student Dashboard
`src/app/student/page.tsx`:
- Welcome header with student name and motivational message
- Stats cards row: Problems Solved, Current Streak, XP / Level, Class Rank
- Recent activity feed (last 5 submissions with pass/fail badges)
- Upcoming exams card (if any scheduled)
- Skill radar chart by category (Arrays, Trees, DP, Strings, etc.)
- Activity heatmap (GitHub-style, last 3 months)

### Step 6: Problem List + Solver
`src/app/student/problems/page.tsx`:
- Filterable problem list: tabs for Programming / Electronics
- Filter by: difficulty, category, status (solved/unsolved/attempted)
- Each problem card shows: title, difficulty badge, category, points, solved status
- Click → navigate to /student/problems/[id]

`src/app/student/problems/[id]/page.tsx` — THE CORE PAGE:
- Split-pane layout (resizable): left = problem description, right = code editor
- Left pane: problem title, difficulty, description (markdown), examples, constraints, hints (expandable, 3 levels)
- Right pane:
  - Language selector (Python, JavaScript, C++, Java) — switching loads starter code if no saved code
  - Monaco Editor with syntax highlighting for selected language
  - Bottom panel tabs: "Test Results" | "Console Output" | "AI Mentor"
  - "Run" button → POST /execute/run → show stdout/stderr in Console tab
  - "Submit" button → POST /submissions → show test results (pass/fail per case) in Test Results tab
  - AI Mentor tab: "Get Hint" button with hint level selector → POST /mentor/hint → display markdown hint

### Step 7: Leaderboard + Profile
`src/app/student/leaderboard/page.tsx`:
- Ranked table: rank, avatar, name, XP, level, problems solved, streak
- Highlight current user's row
- Toggle: class leaderboard vs global

`src/app/student/profile/page.tsx`:
- Profile card: avatar, name, username, role, joined date
- Stats: XP, level, streak, problems solved
- Badge collection grid (earned badges highlighted, unearned grayed out)
- Submission history table with pagination

### Verification
1. `pnpm --filter web dev` — Next.js starts on port 3000
2. Landing page loads with animated hero
3. Login with demo accounts works, redirects to correct dashboard
4. Student dashboard shows stats cards and activity
5. Problem list loads with filters working
6. Problem solver: Monaco Editor renders, language switching works
7. Run/Submit buttons call the API and display results
8. AI Mentor returns hints (or graceful error)
9. Leaderboard displays ranked students

Do NOT build teacher/admin dashboards or exam interface yet.
```

---

## Phase 5: Next.js Frontend — Teacher Dashboard, Exam System, Proctoring

```
You are building SIMULYN — a production-grade educational platform. This is Phase 5: building the teacher dashboard, exam creation/management, live proctoring interface, and the student exam-taking experience.

Phases 1-4 are complete: full backend + student frontend.

## Current state — read this before writing code

### Repo & commands
- Turborepo + pnpm workspaces. Packages: `packages/shared` (`@simulyn/shared`), `apps/api` (package name `api`), `apps/web` (package name `web`).
- `pnpm dev` runs both. `pnpm --filter api dev` (:3001), `pnpm --filter web dev` (:3000).
- `pnpm build` builds all three. `pnpm db:seed` resets the demo data. Swagger at http://localhost:3001/api/docs.
- API smoke suite (needs the API running): `pnpm --filter api test:smoke` — 96 assertions in apps/api/test/smoke.mjs. Note it mutates the DB; re-seed afterwards.
- Node 22, pnpm 9.15. Prisma 6 on SQLite at packages/shared/prisma/dev.db.

### Demo accounts
admin/admin123 · dr.sunitha/teacher1 · sunan/student1 · vivek/student2 · vahini/student3 · sanjan/student4. Class "CSE 2026 Batch A", join code CSE2026A, all 4 students enrolled, all 15 problems assigned.

### Backend conventions to follow
- `JwtAuthGuard` is registered globally; opt out with `@Public()`. `RolesGuard` reads `@Roles(Role.TEACHER, Role.ADMIN)` and ADMIN satisfies every check. `@CurrentUser()` injects `AuthenticatedUser` (or a field: `@CurrentUser('id')`).
- Pagination: extend `PaginationDto` (page/limit/sortBy/order), then `paginated(rows, total, dto)` and `orderByFrom(dto, ALLOWED, fallback)`. **limit is capped at 100** — never request more from the frontend.
- SQLite has no JSON columns: `constraints`, `tags`, `starterCode`, `harness`, `examples`, `params`, `questions`, `questionOrder`, `metadata` are JSON strings. Parse with `parseJson` / `parseJsonOrNull` / `parseStringList` from `@simulyn/shared`.
- Errors go through `HttpExceptionFilter` (maps Prisma P2002/P2025/P2003 to 409/404/400) and return `{ statusCode, error, message, path, timestamp }`.
- Rate limiting: global default 300/min per user; tighten a route with `@Throttle({ default: { limit: 30, ttl: 60_000 } })`.
- **Gotcha that cost real debugging time:** the global ValidationPipe runs with `whitelist: true`, so any DTO property with no class-validator decorator is silently stripped and arrives as `undefined`. Free-form values need at least `@IsDefined()`.

### Frontend conventions to follow
- Tailwind v4, tokens declared in `apps/web/src/app/globals.css` under `@theme`. Colours: `ink` / `ink-raised` / `ink-sunken`, `violet` / `violet-lit` / `violet-dim`, `brass` / `brass-lit`, `paper` / `muted` / `faint`, `trace` (pass) / `fault` (fail) / `warn`, `line` / `line-strong`. Do not introduce new hex values — use these.
- Utility classes: `.glass` (the one card style), `.glass-lift` (hover), `.instrument` (mono uppercase eyebrow/unit label), `.hairline` (brass rule under a label), `.tabular` (numerals), `.prose-lab` (rendered markdown).
- Existing components — reuse, do not re-invent: `Panel` / `PanelHeader` / `PanelBody`, `Button` (variants primary·brass·outline·ghost·danger, sizes sm·md·lg·icon, `loading` prop), `Badge` + `DifficultyBadge`, `Input` / `Select` / `Field`, `Tabs`, `Stat`, `Empty`, `Avatar`, `LevelMeter`, `Skeleton` / `SkeletonPanel`, `AppShell`, `PageTransition`, `CodeEditor`, `ProblemBrief`, `TestResults`, `ConsoleOutput`, `MentorPanel`, `ElectronicsPanel`, `SkillRadar`, `ActivityHeatmap`, `SignalTrace`.
- Data access: `api.get/post/patch/delete` from `@/lib/api` (in-memory access token, single-flight refresh on 401, `credentials: 'include'`), plus the `query({...})` helper for query strings. Response types live in `@/lib/types.ts` — extend that file rather than inlining shapes.
- Auth: `useAuth()` and `useRequireRole('TEACHER')` from `@/hooks/useAuth`. Role layouts already exist at `src/app/teacher/layout.tsx` and `src/app/admin/layout.tsx` with the correct sidebars.
- WebSocket: `createProctoringSocket(token?)` from `@/lib/socket` already connects to the `/proctoring` namespace with the token in the handshake.
- Monaco is self-hosted from `public/monaco/vs` (copied by `scripts/copy-monaco.mjs` on predev/prebuild) — do not switch it back to the CDN. `CodeEditor` already wires Ctrl+Enter → run and Ctrl+Shift+Enter → submit.
- Design direction in one line: lab-instrument surface — near-black panels, violet for live state, brass for measured values, JetBrains Mono for every label and unit, large tabular numerals for readings. The oscilloscope `SignalTrace` is the signature element and stays on the landing/login pages only.

### Backend endpoints that already exist for this phase
- Exams: `POST /exams`, `GET /exams`, `GET /exams/:id`, `PATCH /exams/:id`, `DELETE /exams/:id`, `POST /exams/:id/start`, `POST /exams/:id/submit`, `GET /exams/:id/results`, `GET /exams/:id/attempts/:attemptId`.
- Proctoring: `POST /proctoring/violations`, `GET /proctoring/violations?examId=&userId=&examAttemptId=&typeKey=`, `GET /proctoring/exams/:examId/live` (snapshot for the proctor grid).
- Gateway `/proctoring`, client→server: `join-exam { examId }`, `violation { examAttemptId, typeKey, weight?, codeSnapshot?, timeRemaining?, metadata? }`, `heartbeat { examAttemptId, currentQuestion?, timeRemaining? }` — all three ack with a callback. Server→client: `student-joined`, `student-violation`, `student-heartbeat`, `student-disconnected`, `exam-ended`, `unauthorized`.
- Analytics: `GET /analytics/class/:classId`, `GET /analytics/class/:classId/students`, `GET /analytics/problem/:problemId`, `POST /analytics/classroom-insights { classId }`.
- Classes/problems/users/submissions: everything in Phases 2–3, including `POST /users/bulk` (accepts an optional `classId` that enrolls the batch as it creates it) and `GET /problems/:id/submissions`.

### What Phase 5 must build that does NOT exist yet
- **The discussion API is missing.** The `DiscussionPost` model is in the schema, but there is no NestJS module for it. Before building `DiscussionThread.tsx`, add `apps/api/src/modules/discussions/` with list-by-problem (threaded), create post, create reply, upvote, pin (teacher/admin only) and soft delete.
- **Teacher notes on an attempt have no storage.** `ViolationType.MANUAL` exists for flagging, so either record a flag as `POST /proctoring/violations { typeKey: 'MANUAL', metadata }` or add a proper field — decide and say which.
- `src/app/student/exams/[id]` does not exist. The list page `src/app/student/exams/page.tsx` does, and the dashboard's upcoming-exams card currently links to the list; re-point those links once the detail route exists.
- `src/app/teacher/page.tsx` and `src/app/admin/page.tsx` are minimal placeholders — replace the teacher one with the real dashboard.
- CSV export is frontend-only; there is no export endpoint.

### Environment gotchas on this machine
- Only **python3 and node** are installed. `g++` and `javac` are not, so C++/Java submissions return a clean `compileError` ("g++ is not installed on this server…") instead of running. Python and JavaScript work end to end.
- **Ollama is not running.** `POST /mentor/hint` returns 503 with a readable message and `POST /analytics/classroom-insights` returns full stats with `insights: null` and an `error` string. Both must stay graceful in the UI.
- Seeded students have `mustChangePassword: true`, so signing in as a student redirects to `/change-password` before the dashboard. Flip it in `packages/shared/prisma/seed.ts` if that gets in the way of demos.
- Exam behaviour worth knowing: `GET /exams/:id` returns `problems: null` for a student until they have an open attempt — the questions come from `POST /exams/:id/start`. The attempt deadline is `min(startedAt + durationMin, scheduledEnd + gracePeriodMin)` and the backend rejects any submission past it. Question order is shuffled per student and stored on the attempt.

## Task: Teacher dashboard + Exam system

### Step 1: Teacher Dashboard
`src/app/teacher/page.tsx`:
- Class overview cards: for each class show student count, avg accuracy, active exams
- Quick stats: total students, total submissions, avg pass rate
- Recent activity timeline
- "AI Classroom Insights" panel: calls POST /analytics/classroom-insights, displays AI-generated recommendations

### Step 2: Class Management
`src/app/teacher/classes/page.tsx`:
- List of teacher's classes with create button
- Create class modal: name, description, semester

`src/app/teacher/classes/[id]/page.tsx`:
- Class detail: enrolled students table, assigned problems, scheduled exams
- "Add Students" modal — bulk add by username/email or share join code
- "Assign Problem" modal — search and select from problem bank
- Student rows: click to see individual student's progress

### Step 3: Problem Management
`src/app/teacher/problems/page.tsx`:
- Problem bank with create/edit/delete
- Filter by type (programming/electronics), difficulty, category

`src/app/teacher/problems/create/page.tsx`:
- Full problem creation form:
  - Type toggle: Programming / Electronics
  - For Programming: title, description (markdown editor), difficulty, category, tags, points, starter code per language, test cases (add/remove rows: input + expected), harness config, hints (3 levels)
  - For Electronics: title, description, difficulty, category, params (JSON), questions (add/remove: text + answer + tolerance), hints
- Preview mode before saving

### Step 4: Exam Management
`src/app/teacher/exams/page.tsx`:
- List of exams with status badges (Draft, Scheduled, Active, Completed)
- Create button

`src/app/teacher/exams/create/page.tsx`:
- Exam creation form: title, class (dropdown), duration (minutes), scheduled start/end, grace period, randomize order toggle
- Problem selector: search and add problems from bank, reorder with drag-and-drop, set per-problem points
- Publish toggle

`src/app/teacher/exams/[id]/page.tsx`:
- Exam overview: settings summary, problem list, student attempt stats
- Results table: each student's score, integrity score, time taken, violation count
- Export results as CSV button
- "Live Proctor" button → navigates to proctor view

### Step 5: Live Proctoring View
`src/app/teacher/exams/[id]/proctor/page.tsx`:
THE REAL-TIME PROCTORING DASHBOARD. This is critical.
- Connect to Socket.IO /proctoring namespace, join room teacher:{examId}
- Student cards grid: one card per active student showing:
  - Name, avatar
  - Current question they're on
  - Time remaining
  - Violation count (color-coded: green=0, yellow=1-3, red=4+)
  - Integrity score bar (100 → 0)
  - Status indicator: 🟢 active, 🟡 idle, 🔴 flagged
- Live violation feed: real-time log of violations as they occur (student X copied text, student Y switched tabs)
- Click on student card → expanded view: full violation timeline, code snapshots at each violation, flag/unflag button, teacher notes textarea
- Audio alert toggle: play a sound when a critical violation occurs (devtools, tab switch)
- Class-wide stats bar: total active students, total violations, average integrity score

### Step 6: Student Exam Interface
`src/app/student/exams/page.tsx`:
- List upcoming and past exams
- For each: title, scheduled time, duration, status (upcoming/active/completed/missed)

`src/app/student/exams/[id]/page.tsx`:
THE EXAM EXPERIENCE. This is a full-screen, locked-down interface.
- Before exam starts: show exam info, start time countdown, "Start Exam" button (only active within time window)
- Once started:
  - Full-screen request (optional but prompted)
  - Top bar: exam title, timer (countdown), question navigator (numbered circles showing current/answered/unanswered)
  - Main area: problem description (left) + code editor (right) — same layout as problem solver
  - Each question has its own code state, language selection preserved
  - "Run" runs code, "Submit Answer" submits for this question
  - Navigation: Previous / Next / Jump to question
  - Submit Exam button (with confirmation modal: "Are you sure? You have X unanswered questions")
  - Auto-submit when timer hits 0

- Proctoring client (src/hooks/useProctoring.ts):
  - On exam start: connect to Socket.IO, join exam:{examId} room
  - Detect and report violations:
    - copy/paste/cut: document.addEventListener('copy'/'paste'/'cut')
    - tab switch: document.visibilitychange
    - window blur: window.blur event
    - devtools: detect via debugger timing or window size
    - right-click: contextmenu event
    - fullscreen exit: fullscreenchange event
    - multi-monitor: screen.width > window.screen.availWidth check
    - screenshot: PrintScreen key detection
    - refresh/close: beforeunload event
  - Send violations via socket: "violation" event
  - Send heartbeats every 5 seconds: "heartbeat" event with current question + time remaining
  - Show violation count in the UI (student sees their own count as a warning)

### Step 7: Discussion Forum
`src/components/discussion/DiscussionThread.tsx`:
- Thread-based discussion per problem
- Top-level posts + nested replies
- Markdown support for code blocks
- Upvote button
- Teacher can pin posts
- Show below the problem description on the problem solver page

### Verification
1. Teacher can create a class, add students, assign problems, create an exam
2. Exam appears in student's exam list at the right time
3. Student can start exam, see questions, write code, run, submit answers
4. Timer counts down and auto-submits when it reaches 0
5. Violations are detected and appear in real-time on the teacher's proctor view
6. Teacher sees live student activity via WebSocket
7. Teacher can view exam results and export CSV
8. Discussion threads work on problem pages
```

---

## Phase 6: Admin Panel, Polish, Docker, and Deployment

```
You are building SIMULYN — a production-grade educational platform. This is Phase 6 (final): admin panel, visual polish, Docker containerization, and deployment configuration for a bare-metal university server.

Phases 1-5 are complete.

## Task 1: Admin Panel

`src/app/admin/page.tsx`:
- System overview: total users, classes, problems, submissions, active exams
- Quick action buttons: Create User, Bulk Import, System Health

`src/app/admin/users/page.tsx`:
- Full user management table with pagination, search, role filter
- Create single user modal
- Bulk import: upload CSV (columns: username, email, displayName, password, role) → POST /users/bulk
- Edit user: change role, reset password, toggle isActive
- Impersonate button (Admin can log in as any user for debugging)

`src/app/admin/settings/page.tsx`:
- AI Mentor config: Ollama URL, model name, cloud LLM provider + API key
- Execution limits: max concurrent executions, timeout, max code length
- Rate limits: adjustable per-endpoint
- System health: database size, uptime, active WebSocket connections

## Task 2: Visual Polish
Go through EVERY page and ensure:
- Consistent glassmorphism card styling (backdrop-blur-lg, border border-white/10, bg-white/5)
- Smooth page transitions with framer-motion (fade + slide)
- Loading states: skeleton loaders on all data-fetching pages (NOT spinners)
- Empty states: illustrated empty states with helpful messages ("No problems assigned yet")
- Toast notifications for all actions (success/error) — use sonner or shadcn toast
- Responsive design: sidebar collapses on mobile, exam interface works on tablets
- Keyboard shortcuts: Ctrl+Enter to Run, Ctrl+Shift+Enter to Submit in code editor
- Dark scrollbars styled to match the theme
- Focus styles on all interactive elements (accessibility)

## Task 3: Docker Setup

Create at project root:

`docker-compose.yml` (development):
```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://simulyn:simulyn@db:5432/simulyn
      - JWT_SECRET=${JWT_SECRET}
      - OLLAMA_URL=http://host.docker.internal:11434/api/chat
    depends_on:
      - db
    volumes:
      - ./apps/api:/app/apps/api
      - ./packages:/app/packages
    extra_hosts:
      - "host.docker.internal:host-gateway"

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    depends_on:
      - api

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=simulyn
      - POSTGRES_PASSWORD=simulyn
      - POSTGRES_DB=simulyn
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

`apps/api/Dockerfile`:
- Base: node:20-alpine
- Install: g++, python3, openjdk17-jdk (for code execution)
- Copy packages/shared and apps/api
- Run prisma generate, npm install --production
- CMD: node dist/main.js

`apps/web/Dockerfile`:
- Base: node:20-alpine
- Multi-stage: build stage + production stage
- Copy packages/shared and apps/web
- Build Next.js, serve with `next start`

`docker-compose.prod.yml`:
- Same as dev but:
  - No volume mounts
  - PostgreSQL with stronger password from env
  - NODE_ENV=production
  - Restart: unless-stopped

## Task 4: Database Migration for PostgreSQL
- Update Prisma schema to support both providers:
  - Use `env("DB_PROVIDER")` for provider
  - Add `@db.Text` annotations for long text fields (only when using postgres)
  - Actually: keep the schema SQLite-compatible (no @db.Text) since Prisma handles this
  - Create a migration: `npx prisma migrate dev --name init`

## Task 5: Deployment Script
Create `scripts/deploy.sh`:
```bash
#!/bin/bash
# Deploy to university server
# Prerequisites: Docker + Docker Compose installed on server

set -e

echo "Pulling latest code..."
git pull origin main

echo "Building containers..."
docker compose -f docker-compose.prod.yml build

echo "Running migrations..."
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy

echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo "Seeding database (if first run)..."
docker compose -f docker-compose.prod.yml run --rm api npx prisma db seed

echo "Deployed successfully!"
docker compose -f docker-compose.prod.yml ps
```

## Task 6: README.md
Create a comprehensive README at the project root:
- Project overview
- Tech stack table
- Prerequisites (Node 20, pnpm, Docker, Ollama)
- Quick start (3 commands: clone, install, dev)
- Environment variables table
- Project structure overview
- API documentation link (/api/docs)
- Deployment instructions (Docker)
- Contributing guidelines

## Final Verification
1. `docker compose up` — All services start, frontend at :3000, API at :3001, DB at :5432
2. Login as each role — correct dashboard loads
3. Full student flow: login → solve problem → run → submit → see XP increase → leaderboard updates
4. Full teacher flow: create class → add students → create problem → create exam → proctor exam
5. Full exam flow: student starts exam → writes code → violations detected → teacher sees in real-time → auto-submit on timeout
6. Admin: bulk import users, manage settings
7. AI mentor returns hints (with Ollama running)
8. 20+ concurrent submissions don't crash the server (semaphore works)
```

---

> [!TIP]
> **Usage tips:**
> - Give Claude **one phase at a time** in separate conversations
> - After each phase, verify everything works before starting the next
> - If a phase is too large for one conversation, split it (e.g., Phase 5 can be split into "teacher dashboard" and "exam system")
> - Always paste the phase header context ("Phases 1-N are complete") so Claude understands what exists
> - If Claude's output gets cut off, say "continue from where you left off"
