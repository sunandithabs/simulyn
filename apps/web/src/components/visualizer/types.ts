import type { LangKey, Problem } from '@/lib/types';

export type TraceOp = 'compare' | 'swap' | 'assign' | 'push' | 'pop' | 'visit' | 'return';

export interface TraceEvent {
  step: number;
  op: TraceOp;
  vars: Record<string, unknown>;
  highlights: number[];
  description: string;
  /** 1-based line of the student's code that produced this step, when known. */
  line?: number;
  /** Function this step ran in, and how deep the call stack was (1 = outermost). */
  fn?: string;
  depth?: number;
}

export interface TraceResult {
  ok: boolean;
  /** More steps exist beyond this page. */
  truncated: boolean;
  /** Steps skipped before the first event here. */
  offset: number;
  /** Where the next page starts, or null when the run is fully covered. */
  nextOffset: number | null;
  events: TraceEvent[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  compileError: string | null;
  /** Line in the student's code behind the compile error or crash, when known. */
  errorLine?: number | null;
  executionMs: number;
  fidelity: 'full' | 'partial' | 'manual';
}

/** Which renderer a problem gets. */
export type VisualizerKind =
  | 'array'
  | 'chars'
  | 'stack'
  | 'linkedList'
  | 'tree'
  | 'matrix'
  | 'grid'
  | 'circuit';

export interface VisualizerPlan {
  kind: VisualizerKind;
  /** Second panel, used where one view cannot carry the whole idea. */
  secondary?: VisualizerKind;
  label: string;
  /** Harness parameter names, in order — the renderer's first choice of data. */
  paramNames: string[];
  why: string;
}

export interface RendererProps {
  event: TraceEvent | null;
  plan: VisualizerPlan;
  problem: Problem;
  /** Drives the flash on values that changed since the previous step. */
  previous: TraceEvent | null;
  /** The call stack at this step, outermost first. Empty when the language does not report one. */
  frames?: Frame[];
}

/** One live call on the stack: its function, the line it is paused on, and its locals. */
export interface Frame {
  fn: string;
  depth: number;
  line?: number;
  vars: Record<string, unknown>;
  step: number;
}

export interface TraceRequest {
  problemId: string;
  code: string;
  lang: LangKey;
  testCaseIndex?: number;
  offset?: number;
}
