/**
 * Execution trace format.
 *
 * A traced run emits one JSON object per line on stdout, each prefixed with
 * TRACE_MARKER. The runner strips those lines out, so the student's own
 * printing still reaches the console untouched.
 */

export const TRACE_MARKER = '__SIMULYN_TRACE__';

/**
 * Steps returned per request. A longer run is paged: the driver skips the
 * first `offset` steps silently, so a tight loop still cannot emit millions of
 * lines in one response.
 */
export const MAX_TRACE_EVENTS = 5000;

/** The furthest a run can be paged into. */
export const MAX_TRACE_OFFSET = 100_000;

export type TraceOp =
  | 'compare'
  | 'swap'
  | 'assign'
  | 'push'
  | 'pop'
  | 'visit'
  | 'return';

export interface TraceEvent {
  step: number;
  op: TraceOp;
  /** Locals in scope at this step, already reduced to JSON-safe values. */
  vars: Record<string, unknown>;
  /** Indices the renderer should light up — pointer variables, mostly. */
  highlights: number[];
  description: string;
  /** 1-based line of the student's code that produced this step, when known. */
  line?: number;
  /** Function the step ran in, and how deep the call stack was (1 = outermost). */
  fn?: string;
  depth?: number;
}

export interface TraceResult {
  ok: boolean;
  /** True when more steps exist beyond this page — ask again with `nextOffset`. */
  truncated: boolean;
  /** Steps skipped before this page began. */
  offset: number;
  /** Where the next page starts; null when the run is fully covered. */
  nextOffset: number | null;
  events: TraceEvent[];
  /** Whatever the student printed, with trace lines removed. */
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  compileError: string | null;
  /** Line in the student's code behind the compile error or crash, when it can be told. */
  errorLine: number | null;
  executionMs: number;
  /**
   * How much of the run this language can actually report. Python is traced
   * line by line; JavaScript reports array reads and writes; the compiled
   * languages report only what the student's code emits explicitly.
   */
  fidelity: 'full' | 'partial' | 'manual';
}
