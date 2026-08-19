import type { Problem } from '@/lib/types';
import type { VisualizerPlan } from './types';

interface HarnessShape {
  funcName?: string;
  returnType?: string;
  params?: { name: string; type: string }[];
}

/**
 * Chooses a renderer for a problem.
 *
 * Category is checked first because it is what the author actually meant, then
 * the harness parameter types as a fallback. Every category in the seeded bank
 * is covered, plus reasonable aliases so a new problem does not fall through.
 */
const BY_CATEGORY: Record<string, { kind: VisualizerPlan['kind']; secondary?: VisualizerPlan['kind']; why: string }> = {
  arrays: { kind: 'array', why: 'Indexed boxes with pointer markers.' },
  array: { kind: 'array', why: 'Indexed boxes with pointer markers.' },
  'two pointers': {
    kind: 'array',
    why: 'Indexed boxes — the two pointers and the window between them are marked.',
  },
  strings: { kind: 'chars', why: 'One box per character, with the cursor marked.' },
  string: { kind: 'chars', why: 'One box per character, with the cursor marked.' },
  stacks: { kind: 'stack', why: 'A stack that grows upward, beside the input being consumed.' },
  stack: { kind: 'stack', why: 'A stack that grows upward, beside the input being consumed.' },
  'linked lists': { kind: 'linkedList', why: 'Nodes joined by arrows; the order flips on reversal.' },
  'linked list': { kind: 'linkedList', why: 'Nodes joined by arrows; the order flips on reversal.' },
  trees: { kind: 'tree', why: 'Level-based layout with the visited node lit.' },
  tree: { kind: 'tree', why: 'Level-based layout with the visited node lit.' },
  'binary tree': { kind: 'tree', why: 'Level-based layout with the visited node lit.' },
  'dynamic programming': {
    kind: 'array',
    secondary: 'matrix',
    why: 'The running array plus the table it fills, with dependency arrows.',
  },
  dp: {
    kind: 'array',
    secondary: 'matrix',
    why: 'The running array plus the table it fills, with dependency arrows.',
  },
  graphs: { kind: 'grid', why: 'The grid, with visited cells filled in as the search spreads.' },
  graph: { kind: 'grid', why: 'The grid, with visited cells filled in as the search spreads.' },
  matrix: { kind: 'grid', why: 'Cell values as they change.' },
  'hash tables': {
    kind: 'array',
    why: 'The input list, with the key being bucketed highlighted.',
  },
  'hash table': { kind: 'array', why: 'The input list, with the key being bucketed highlighted.' },
  backtracking: {
    kind: 'grid',
    secondary: 'array',
    why: 'The board being filled and unfilled as the search backtracks.',
  },
  intervals: { kind: 'array', why: 'Intervals as bars along a shared axis.' },
};

/** Harness parameter types, used when the category is unfamiliar. */
const BY_PARAM_TYPE: Record<string, VisualizerPlan['kind']> = {
  listNode: 'linkedList',
  treeNode: 'tree',
  grid: 'grid',
  intArray: 'array',
  stringArray: 'array',
  string: 'chars',
};

const LABELS: Record<VisualizerPlan['kind'], string> = {
  array: 'Array',
  chars: 'Characters',
  stack: 'Stack',
  linkedList: 'Linked list',
  tree: 'Tree',
  matrix: 'DP table',
  grid: 'Grid',
  circuit: 'Circuit',
};

export function labelFor(kind: VisualizerPlan['kind']): string {
  return LABELS[kind];
}

export function resolveVisualizer(problem: Problem): VisualizerPlan | null {
  if (problem.type === 'ELECTRONICS') {
    return {
      kind: 'circuit',
      label: LABELS.circuit,
      paramNames: [],
      why: 'The circuit these questions describe, drawn from its parameters.',
    };
  }

  const harness = (problem.harness ?? {}) as HarnessShape;
  const params = harness.params ?? [];
  const paramNames = params.map((param) => param.name);

  const byCategory = BY_CATEGORY[problem.category.trim().toLowerCase()];
  if (byCategory) {
    return {
      kind: byCategory.kind,
      secondary: byCategory.secondary,
      label: LABELS[byCategory.kind],
      paramNames,
      why: byCategory.why,
    };
  }

  // Fall back to the shape of the function's arguments.
  for (const param of params) {
    const kind = BY_PARAM_TYPE[param.type];
    if (kind) {
      return {
        kind,
        label: LABELS[kind],
        paramNames,
        why: `Chosen from the ${param.type} parameter.`,
      };
    }
  }

  // Anything with a harness can still show its variables stepping along.
  if (params.length > 0) {
    return {
      kind: 'array',
      label: LABELS.array,
      paramNames,
      why: 'Generic view of the values in scope.',
    };
  }

  return null;
}
