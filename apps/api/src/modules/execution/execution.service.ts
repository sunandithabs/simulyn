import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseJsonOrNull, type ElectronicsQuestion } from '@simulyn/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { outputsMatch } from './compare';
import { codeOffset, locateErrorLine } from './error-line';
import { Executor, normaliseJavaSource, type LangKey, type RunOutcome } from './executor';
import {
  assertValidHarness,
  buildProgram,
  generateTracedDriver,
  instrumentedDriver,
  HarnessError,
  RESULT_MARKER,
  traceFidelity,
  type HarnessSpec,
} from './harness';
import {
  MAX_TRACE_EVENTS,
  MAX_TRACE_OFFSET,
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
  /** AC accepted · WA wrong answer · RE runtime error · TLE timed out · NO_OUTPUT driver never returned. */
  verdict: 'AC' | 'WA' | 'RE' | 'TLE' | 'NO_OUTPUT';
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
    verdict: outcome.passed ? 'AC' : outcome.timedOut ? 'TLE' : 'WA',
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
      // One past the page: the driver emits a spare step so "more" is certain.
      if (events.length <= MAX_TRACE_EVENTS) events.push(event);
    } catch {
      // A partially flushed line is not worth failing the whole run over.
    }
  }

  const truncated = events.length > MAX_TRACE_EVENTS;
  if (truncated) events.length = MAX_TRACE_EVENTS;

  return { events, truncated, remainder: kept.join('\n') };
}

export function splitDriverOutput(raw: string): {
  actual: string;
  studentOutput: string;
  found: boolean;
} {
  // lastIndexOf: the driver writes its marker last, so a student echoing the
  // same string earlier cannot hijack the parse.
  const at = raw.lastIndexOf(RESULT_MARKER);
  // No marker means the driver never reached its own return line (early exit,
  // stray print) — never treat raw stdout as the answer.
  if (at === -1) return { actual: '', studentOutput: raw.trim(), found: false };

  return {
    found: true,
    actual: raw.slice(at + RESULT_MARKER.length).trim(),
    studentOutput: raw.slice(0, at).trim(),
  };
}

export interface EvaluationResult {
  ok: boolean;
  allPassed: boolean;
  compileError: string | null;
  /** Line in the student's code behind a compile error or a visible-case crash. */
  errorLine: number | null;
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

  /**
   * Run button: executes the student's function through the problem's harness
   * (which supplies main) against a visible case, or custom stdin if given.
   */
  async runForProblem(
    problemId: string,
    code: string,
    lang: LangKey,
    stdin?: string,
  ): Promise<RunOutcome & { errorLine: number | null }> {
    const problem = await this.prisma.problem.findUnique({
      where: { id: problemId },
      include: { testCases: { where: { isHidden: false }, orderBy: { order: 'asc' }, take: 1 } },
    });
    if (!problem) throw new NotFoundException(`Problem ${problemId} not found`);
    if (problem.type !== 'PROGRAMMING') return { ...(await this.run(lang, code, stdin ?? '')), errorLine: null };

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

    const input = stdin?.trim() ? stdin : (problem.testCases[0]?.input ?? '');
    const program = buildProgram(lang, code, spec, input);
    const out = await this.executor.execute(lang, program, '', { timeoutMs: this.timeoutMs });
    const { actual, studentOutput, found } = splitDriverOutput(out.stdout);
    const stdout = [studentOutput, found ? `=> ${actual}` : ''].filter(Boolean).join('\n');
    const errorLine = locateErrorLine(
      lang,
      out.compileError ?? out.stderr,
      codeOffset(lang, program, code),
      code,
    );
    return { ...out, stdout, errorLine };
  }

  // ── evaluation against a problem's test cases ──────────────────────

  async evaluateProblem(
    problemId: string,
    code: string,
    lang: LangKey,
    options: { visibleOnly?: boolean } = {},
  ): Promise<EvaluationResult> {
    const problem = await this.prisma.problem.findUnique({
      where: { id: problemId },
      include: {
        testCases: {
          where: options.visibleOnly ? { isHidden: false } : undefined,
          orderBy: { order: 'asc' },
        },
      },
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
    const offset = codeOffset(lang, program, code);
    const prepared = await this.executor.prepare(lang, program, { timeoutMs: this.timeoutMs });
    const startedAt = Date.now();

    try {
      if (prepared.compileError) {
        return {
          ok: false,
          allPassed: false,
          compileError: prepared.compileError,
          errorLine: locateErrorLine(lang, prepared.compileError, offset, code),
          results: [],
          passedCount: 0,
          totalCount: problem.testCases.length,
          totalMs: Date.now() - startedAt,
        };
      }

      const results: TestOutcome[] = [];
      for (const [index, testCase] of problem.testCases.entries()) {
        const run = await prepared.run(testCase.input, { timeoutMs: this.timeoutMs });
        const { actual, studentOutput, found } = splitDriverOutput(run.stdout);
        const passed =
          found &&
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
          verdict: passed
            ? 'AC'
            : run.timedOut
              ? 'TLE'
              : run.exitCode !== 0
                ? 'RE'
                : !found
                  ? 'NO_OUTPUT'
                  : 'WA',
          stderr: run.stderr.trim() || null,
          exitCode: run.exitCode,
          timedOut: run.timedOut,
          executionMs: run.executionMs,
        });
      }

      const passedCount = results.filter((r) => r.passed).length;
      // Hidden cases never contribute: even a line number says something about them.
      const crashed = results.find((r) => !r.isHidden && r.exitCode !== 0 && r.stderr);
      return {
        ok: true,
        allPassed: passedCount === results.length,
        compileError: null,
        errorLine: crashed ? locateErrorLine(lang, crashed.stderr, offset, code) : null,
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
    offset = 0,
  ): Promise<TraceResult> {
    offset = Math.min(Math.max(Math.floor(offset) || 0, 0), MAX_TRACE_OFFSET);
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

    // C++ and Java: try the line-by-line instrumented build first. If it does
    // not compile (unusual syntax the instrumenter mishandled) fall back to the
    // plain driver, which also yields the student's own, accurate compile error.
    let instrumented = false;
    let plainProgram: string | null = null;
    let prepared = null as Awaited<ReturnType<Executor['prepare']>> | null;
    const inst = instrumentedDriver(lang, code, spec, testCase.input, offset);
    if (inst) {
      const attempt = await this.executor.prepare(lang, inst, { timeoutMs: this.timeoutMs });
      if (attempt.compileError) await attempt.dispose();
      else {
        prepared = attempt;
        instrumented = true;
      }
    }
    if (!prepared) {
      plainProgram = generateTracedDriver(lang, code, spec, testCase.input, offset);
      prepared = await this.executor.prepare(lang, plainProgram, { timeoutMs: this.timeoutMs });
    }

    try {
      if (prepared.compileError) {
        return {
          ok: false,
          truncated: false,
          offset,
          nextOffset: null,
          events: [],
          stdout: '',
          stderr: '',
          exitCode: null,
          timedOut: false,
          compileError: prepared.compileError,
          errorLine: plainProgram
            ? locateErrorLine(lang, prepared.compileError, codeOffset(lang, plainProgram, code), code)
            : null,
          executionMs: 0,
          fidelity: traceFidelity(lang, instrumented),
        };
      }

      // A traced run emits far more output than a plain one.
      const run = await prepared.run('', {
        timeoutMs: this.timeoutMs,
        maxOutputBytes: 12 * 1024 * 1024,
      });

      const { events, truncated, remainder } = extractTraceEvents(run.stdout);
      const { studentOutput } = splitDriverOutput(remainder);

      return {
        ok: !run.timedOut && run.exitCode === 0,
        truncated,
        offset,
        nextOffset: truncated ? offset + events.length : null,
        events,
        stdout: studentOutput,
        stderr: run.stderr.trim(),
        exitCode: run.exitCode,
        timedOut: run.timedOut,
        compileError: null,
        errorLine: plainProgram
          ? locateErrorLine(lang, run.stderr, codeOffset(lang, plainProgram, code), code)
          : null,
        executionMs: run.executionMs,
        fidelity: traceFidelity(lang, instrumented),
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
