import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseJsonOrNull, type ElectronicsQuestion } from '@simulyn/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { outputsMatch } from './compare';
import { Executor, normaliseJavaSource, type LangKey, type RunOutcome } from './executor';
import {
  assertValidHarness,
  buildProgram,
  generateTracedDriver,
  HarnessError,
  RESULT_MARKER,
  traceFidelity,
  type HarnessSpec,
} from './harness';
import {
  MAX_TRACE_EVENTS,
  TRACE_MARKER,
  type TraceEvent,
  type TraceResult,
} from './trace.types';

export interface TestOutcome {
  index: number;
  isHidden: boolean;
  input: string;
  expected: string;
  actual: string | null;
  /** Anything the student printed themselves — never part of the comparison. */
  stdout: string | null;
  passed: boolean;
  stderr: string | null;
  exitCode: number | null;
  timedOut: boolean;
  executionMs: number;
}

/** Shown in place of a hidden case's error, carrying no student content. */
export const HIDDEN_ERROR_NOTICE = 'Your code raised an error on this hidden case.';

/**
 * Strips every student-controlled channel from a hidden test case.
 *
 * Submissions run against hidden cases too, so anything echoed back is a way to
 * read them: `print(nums)` leaks the input through stdout, an exception message
 * leaks it through stderr (a dynamically named exception class defeats even
 * type-only filtering), and `sys.exit(nums[0])` leaks an integer per case
 * through the exit code. Only the verdict, the timing and whether it timed out
 * survive.
 */
export function maskHiddenOutcome(outcome: TestOutcome): TestOutcome {
  return {
    ...outcome,
    input: 'hidden',
    expected: 'hidden',
    actual: outcome.actual === null ? null : 'hidden',
    stdout: null,
    stderr: outcome.stderr ? HIDDEN_ERROR_NOTICE : null,
    exitCode: null,
  };
}

/**
 * Splits the driver's return value from whatever the student printed.
 *
 * Without this a stray `print()` inside an otherwise correct solution would
 * land in stdout ahead of the result and fail every case.
 */
/**
 * Pulls trace lines out of stdout, leaving the student's own printing behind.
 *
 * The marker can appear mid-line when their last print had no trailing
 * newline, so each line is split at the marker rather than merely tested with
 * startsWith.
 */
export function extractTraceEvents(raw: string): {
  events: TraceEvent[];
  truncated: boolean;
  remainder: string;
} {
  if (!raw.includes(TRACE_MARKER)) {
    return { events: [], truncated: false, remainder: raw };
  }

  const events: TraceEvent[] = [];
  const kept: string[] = [];

  for (const line of raw.split('\n')) {
    const at = line.indexOf(TRACE_MARKER);
    if (at === -1) {
      kept.push(line);
      continue;
    }

    if (at > 0) kept.push(line.slice(0, at));

    try {
      const event = JSON.parse(line.slice(at + TRACE_MARKER.length)) as TraceEvent;
      if (events.length < MAX_TRACE_EVENTS) events.push(event);
    } catch {
      // A partially flushed line is not worth failing the whole run over.
    }
  }

  return {
    events,
    truncated: events.length >= MAX_TRACE_EVENTS,
    remainder: kept.join('\n'),
  };
}

export function splitDriverOutput(raw: string): { actual: string; studentOutput: string } {
  // lastIndexOf: the driver writes its marker last, so a student echoing the
  // same string earlier cannot hijack the parse.
  const at = raw.lastIndexOf(RESULT_MARKER);
  if (at === -1) return { actual: raw.trim(), studentOutput: '' };

  return {
    actual: raw.slice(at + RESULT_MARKER.length).trim(),
    studentOutput: raw.slice(0, at).trim(),
  };
}

export interface EvaluationResult {
  ok: boolean;
  allPassed: boolean;
  compileError: string | null;
  results: TestOutcome[];
  passedCount: number;
  totalCount: number;
  totalMs: number;
}

export interface ElectronicsOutcome {
  questionId: string;
  text: string;
  expected: number;
  actual: number | null;
  tolerance: number;
  unit: string | null;
  correct: boolean;
}

export interface ElectronicsResult {
  allCorrect: boolean;
  score: number;
  correctCount: number;
  totalCount: number;
  results: ElectronicsOutcome[];
}

@Injectable()
export class ExecutionService implements OnModuleInit {
  private readonly logger = new Logger(ExecutionService.name);
  private readonly executor: Executor;
  private readonly timeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.executor = new Executor(config.get<number>('execution.maxConcurrency') ?? 20);
    this.timeoutMs = config.get<number>('execution.timeoutMs') ?? 8000;
  }

  onModuleInit(): void {
    const available = this.executor.availability();
    const usable = Object.entries(available)
      .filter(([, ok]) => ok)
      .map(([lang]) => lang);
    const missing = Object.entries(available)
      .filter(([, ok]) => !ok)
      .map(([lang]) => lang);

    this.logger.log(`Execution runtimes available: ${usable.join(', ') || 'none'}`);
    if (missing.length > 0) {
      this.logger.warn(
        `Missing runtimes (submissions in these languages will report a toolchain error): ${missing.join(', ')}`,
      );
    }
  }

  /** Which languages this host can run, plus live semaphore state. */
  health() {
    return {
      languages: this.executor.availability(),
      concurrency: this.executor.concurrency,
      timeoutMs: this.timeoutMs,
    };
  }

  // ── raw run ────────────────────────────────────────────────────────

  /**
   * Runs code exactly as written. Java sources are relaxed first (imports
   * hoisted, `public` stripped) so a snippet compiles inside our Main.java.
   */
  async run(lang: LangKey, code: string, stdin = ''): Promise<RunOutcome> {
    let source = code;
    if (lang === 'java') {
      const { imports, body } = normaliseJavaSource(code);
      source = `${imports.join('\n')}\n${body}`;
    }
    return this.executor.execute(lang, source, stdin, { timeoutMs: this.timeoutMs });
  }

  // ── evaluation against a problem's test cases ──────────────────────

  async evaluateProblem(problemId: string, code: string, lang: LangKey): Promise<EvaluationResult> {
    const problem = await this.prisma.problem.findUnique({
      where: { id: problemId },
      include: { testCases: { orderBy: { order: 'asc' } } },
    });
    if (!problem) throw new NotFoundException(`Problem ${problemId} not found`);
    if (problem.type !== 'PROGRAMMING') {
      throw new BadRequestException('This is an electronics problem — use POST /electronics/submit');
    }
    if (problem.testCases.length === 0) {
      throw new BadRequestException('This problem has no test cases yet');
    }

    let spec: HarnessSpec;
    try {
      const parsed = parseJsonOrNull<HarnessSpec>(problem.harness);
      assertValidHarness(parsed);
      spec = parsed;
    } catch (error) {
      throw new BadRequestException(
        error instanceof HarnessError ? error.message : 'This problem has an invalid harness definition',
      );
    }

    const program = buildProgram(lang, code, spec);
    const prepared = await this.executor.prepare(lang, program, { timeoutMs: this.timeoutMs });
    const startedAt = Date.now();

    try {
      if (prepared.compileError) {
        return {
          ok: false,
          allPassed: false,
          compileError: prepared.compileError,
          results: [],
          passedCount: 0,
          totalCount: problem.testCases.length,
          totalMs: Date.now() - startedAt,
        };
      }

      const results: TestOutcome[] = [];
      for (const [index, testCase] of problem.testCases.entries()) {
        const run = await prepared.run(testCase.input, { timeoutMs: this.timeoutMs });
        const { actual, studentOutput } = splitDriverOutput(run.stdout);
        const passed =
          !run.timedOut &&
          run.exitCode === 0 &&
          outputsMatch(actual, testCase.expected, spec.normalize);

        results.push({
          index,
          isHidden: testCase.isHidden,
          input: testCase.input,
          expected: testCase.expected,
          actual: actual || null,
          stdout: studentOutput || null,
          passed,
          stderr: run.stderr.trim() || null,
          exitCode: run.exitCode,
          timedOut: run.timedOut,
          executionMs: run.executionMs,
        });
      }

      const passedCount = results.filter((r) => r.passed).length;
      return {
        ok: true,
        allPassed: passedCount === results.length,
        compileError: null,
        results,
        passedCount,
        totalCount: results.length,
        totalMs: Date.now() - startedAt,
      };
    } finally {
      await prepared.dispose();
    }
  }

  /** Hides everything about a hidden case except whether it passed. */
  maskHidden(result: EvaluationResult): EvaluationResult {
    return {
      ...result,
      results: result.results.map((r) => (r.isHidden ? maskHiddenOutcome(r) : r)),
    };
  }

  // ── traced run ─────────────────────────────────────────────────────

  /**
   * Runs one test case through a driver that narrates itself, so the
   * visualiser can replay what the student's code actually did.
   *
   * Only a visible test case can be traced — replaying a hidden one would
   * hand over its input a step at a time.
   */
  async runWithTrace(
    problemId: string,
    code: string,
    lang: LangKey,
    testCaseIndex = 0,
  ): Promise<TraceResult> {
    const problem = await this.prisma.problem.findUnique({
      where: { id: problemId },
      include: { testCases: { orderBy: { order: 'asc' } } },
    });
    if (!problem) throw new NotFoundException(`Problem ${problemId} not found`);
    if (problem.type !== 'PROGRAMMING') {
      throw new BadRequestException('Only programming problems can be traced');
    }

    const visible = problem.testCases.filter((testCase) => !testCase.isHidden);
    if (visible.length === 0) {
      throw new BadRequestException('This problem has no visible test case to trace');
    }
    const testCase = visible[Math.min(Math.max(testCaseIndex, 0), visible.length - 1)];

    let spec: HarnessSpec;
    try {
      const parsed = parseJsonOrNull<HarnessSpec>(problem.harness);
      assertValidHarness(parsed);
      spec = parsed;
    } catch (error) {
      throw new BadRequestException(
        error instanceof HarnessError ? error.message : 'This problem has an invalid harness',
      );
    }

    const program = generateTracedDriver(lang, code, spec, testCase.input);
    const prepared = await this.executor.prepare(lang, program, { timeoutMs: this.timeoutMs });

    try {
      if (prepared.compileError) {
        return {
          ok: false,
          truncated: false,
          events: [],
          stdout: '',
          stderr: '',
          exitCode: null,
          timedOut: false,
          compileError: prepared.compileError,
          executionMs: 0,
          fidelity: traceFidelity(lang),
        };
      }

      // A traced run emits far more output than a plain one.
      const run = await prepared.run('', {
        timeoutMs: this.timeoutMs,
        maxOutputBytes: 4 * 1024 * 1024,
      });

      const { events, truncated, remainder } = extractTraceEvents(run.stdout);
      const { studentOutput } = splitDriverOutput(remainder);

      return {
        ok: !run.timedOut && run.exitCode === 0,
        truncated,
        events,
        stdout: studentOutput,
        stderr: run.stderr.trim(),
        exitCode: run.exitCode,
        timedOut: run.timedOut,
        compileError: null,
        executionMs: run.executionMs,
        fidelity: traceFidelity(lang),
      };
    } finally {
      await prepared.dispose();
    }
  }

  // ── electronics ────────────────────────────────────────────────────

  async validateElectronics(
    problemId: string,
    answers: { questionId: string; value: number | string }[],
  ): Promise<ElectronicsResult> {
    const problem = await this.prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) throw new NotFoundException(`Problem ${problemId} not found`);
    if (problem.type !== 'ELECTRONICS') {
      throw new BadRequestException('This is a programming problem — use POST /execute/submit');
    }

    const questions = parseJsonOrNull<ElectronicsQuestion[]>(problem.questions) ?? [];
    if (questions.length === 0) {
      throw new BadRequestException('This problem has no questions yet');
    }

    const given = new Map(answers.map((a) => [a.questionId, a.value]));

    const results: ElectronicsOutcome[] = questions.map((q) => {
      const raw = given.get(q.id);
      const actual = raw === undefined || raw === null || raw === '' ? null : Number(raw);
      const correct =
        actual !== null && Number.isFinite(actual) && Math.abs(actual - q.answer) <= q.tolerance;

      return {
        questionId: q.id,
        text: q.text,
        expected: q.answer,
        actual: actual !== null && Number.isFinite(actual) ? actual : null,
        tolerance: q.tolerance,
        unit: q.unit ?? null,
        correct,
      };
    });

    const correctCount = results.filter((r) => r.correct).length;
    return {
      allCorrect: correctCount === results.length,
      score: Math.round((correctCount / results.length) * problem.points),
      correctCount,
      totalCount: results.length,
      results,
    };
  }
}
