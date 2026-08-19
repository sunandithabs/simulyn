/**
 * Execution trace format.
 *
 * A traced run emits one JSON object per line on stdout, each prefixed with
 * TRACE_MARKER. The runner strips those lines out, so the student's own
 * printing still reaches the console untouched.
 */

export const TRACE_MARKER = '__SIMULYN_TRACE__';

/** Hard ceiling — a tight loop would otherwise emit millions of lines. */
export const MAX_TRACE_EVENTS = 5000;

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
}

export interface TraceResult {
  ok: boolean;
  /** True when the cap was hit and the tail of the run is missing. */
  truncated: boolean;
  events: TraceEvent[];
  /** Whatever the student printed, with trace lines removed. */
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  compileError: string | null;
  executionMs: number;
  /**
   * How much of the run this language can actually report. Python is traced
   * line by line; JavaScript reports array reads and writes; the compiled
   * languages report only what the student's code emits explicitly.
   */
  fidelity: 'full' | 'partial' | 'manual';
}
