import type { LangKey, Problem } from '@/lib/types';

export type TraceOp = 'compare' | 'swap' | 'assign' | 'push' | 'pop' | 'visit' | 'return';

export interface TraceEvent {
  step: number;
  op: TraceOp;
  vars: Record<string, unknown>;
  highlights: number[];
  description: string;
}

export interface TraceResult {
  ok: boolean;
  truncated: boolean;
  events: TraceEvent[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  compileError: string | null;
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
}

export interface TraceRequest {
  problemId: string;
  code: string;
  lang: LangKey;
  testCaseIndex?: number;
}
