import type { Frame, TraceEvent } from './types';

/**
 * The call stack at one step, outermost first.
 *
 * Each event says which depth it ran at, so the stack is the most recent event
 * seen at every depth up to the current one. A frame that has already returned
 * sits above the current depth and is ignored. Frames before the first event of
 * a paged trace are simply absent.
 */
export function stackAt(events: TraceEvent[], index: number): Frame[] {
  if (events.length === 0) return [];
  const upto = Math.min(Math.max(index, 0), events.length - 1);
  const current = events[upto];
  if (!current.depth || current.depth < 1) return [];

  const byDepth: (Frame | undefined)[] = [];
  for (let i = 0; i <= upto; i++) {
    const event = events[i];
    if (!event.depth || event.depth < 1) continue;
    byDepth[event.depth] = {
      fn: event.fn ?? 'function',
      depth: event.depth,
      line: event.line,
      vars: event.vars,
      step: event.step,
    };
  }

  const frames: Frame[] = [];
  for (let depth = 1; depth <= current.depth; depth++) {
    const frame = byDepth[depth];
    if (frame) frames.push(frame);
  }
  return frames;
}

/**
 * Flags the steps where a variable changed inside the same call. Moving into
 * or out of a call replaces every variable on screen, which says nothing about
 * what the code did, so those steps do not count.
 */
export function changeFlags(events: TraceEvent[]): Uint8Array {
  const flags = new Uint8Array(events.length);
  let previous = events.length > 0 ? JSON.stringify(events[0].vars) : '';
  for (let i = 1; i < events.length; i++) {
    const text = JSON.stringify(events[i].vars);
    const sameCall = events[i].depth === events[i - 1].depth && events[i].fn === events[i - 1].fn;
    if (sameCall && text !== previous) flags[i] = 1;
    previous = text;
  }
  return flags;
}

/** Index of the nearest flagged step after (dir 1) or before (dir -1) `from`, or null. */
export function nextChange(flags: Uint8Array, from: number, dir: 1 | -1): number | null {
  for (let i = from + dir; i >= 0 && i < flags.length; i += dir) {
    if (flags[i]) return i;
  }
  return null;
}

// ───────────────────────────────────────────── following a tree's recursion ──

export interface TreeRef {
  index: number;
  value: unknown;
  left?: TreeRef;
  right?: TreeRef;
}

/** Rebuilds a tree from the level-order array the tracer emits (null = missing child). */
export function buildTree(levelOrder: unknown[]): TreeRef | null {
  if (levelOrder.length === 0 || levelOrder[0] === null || levelOrder[0] === undefined) return null;

  const root: TreeRef = { index: 0, value: levelOrder[0] };
  const queue: TreeRef[] = [root];
  let cursor = 1;
  let head = 0;

  while (head < queue.length && cursor < levelOrder.length) {
    const node = queue[head++];
    for (const side of ['left', 'right'] as const) {
      if (cursor >= levelOrder.length) break;
      const value = levelOrder[cursor];
      const index = cursor++;
      if (value === null || value === undefined) continue;
      const child: TreeRef = { index, value };
      node[side] = child;
      queue.push(child);
    }
  }
  return root;
}

/** The level-order array of the subtree under `node`, trailing nulls trimmed. */
export function dumpTree(node: TreeRef | undefined): unknown[] {
  if (!node) return [];
  const out: unknown[] = [];
  const queue: (TreeRef | undefined)[] = [node];
  for (let head = 0; head < queue.length; head++) {
    const n = queue[head];
    if (!n) {
      out.push(null);
      continue;
    }
    out.push(n.value);
    queue.push(n.left, n.right);
  }
  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  return out;
}

export interface TreePath {
  /** Node indices from the root down to the node the innermost call is on. */
  path: number[];
  /** True when that call received an empty child, so the node is its parent. */
  atEmptyChild: boolean;
}

/**
 * Which node of the whole tree each recursive call is standing on.
 *
 * `frameTrees` holds the subtree every call was handed, outermost first. Each
 * call's subtree must equal the left or right child of the one above it; when
 * neither matches (the tree was edited, or the calls are not on a tree) the
 * path stops there and null comes back for a first call that does not fit.
 */
export function followTree(whole: unknown[], frameTrees: (unknown[] | null)[]): TreePath | null {
  const root = buildTree(whole);
  if (!root || frameTrees.length === 0) return null;
  if (!frameTrees[0] || JSON.stringify(frameTrees[0]) !== JSON.stringify(dumpTree(root))) return null;

  let current = root;
  const path = [root.index];
  let atEmptyChild = false;

  for (let i = 1; i < frameTrees.length; i++) {
    const subtree = frameTrees[i];
    if (!subtree) break;

    if (subtree.length === 0) {
      atEmptyChild = true;
      break;
    }
    const key = JSON.stringify(subtree);
    const next =
      current.left && JSON.stringify(dumpTree(current.left)) === key
        ? current.left
        : current.right && JSON.stringify(dumpTree(current.right)) === key
          ? current.right
          : null;
    if (!next) break;
    current = next;
    path.push(current.index);
  }
  return { path, atEmptyChild };
}
