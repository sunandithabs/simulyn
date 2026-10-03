// The call stack and the tree path are rebuilt from flat trace events, so the
// replay can show which recursive call — and which tree node — a step belongs to.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { stackAt, changeFlags, nextChange, followTree, buildTree, dumpTree } = await import(
  '../src/components/visualizer/stack.ts'
);

const ev = (step, depth, vars, fn = 'f') => ({ step, op: 'assign', vars, highlights: [], description: '', depth, fn, line: step });

test('the stack is the latest frame at each depth, up to the current one', () => {
  const events = [ev(1, 1, { n: 3 }), ev(2, 2, { n: 2 }), ev(3, 3, { n: 1 }), ev(4, 2, { n: 2, r: 1 }), ev(5, 1, { n: 3 })];
  assert.deepEqual(stackAt(events, 2).map((f) => f.vars.n), [3, 2, 1]);
  // After the inner calls returned, only the outer frames remain, with their newest locals.
  assert.deepEqual(stackAt(events, 3).map((f) => f.vars.n), [3, 2]);
  assert.equal(stackAt(events, 3)[1].vars.r, 1);
  assert.equal(stackAt(events, 4).length, 1);
});

test('events without a depth give an empty stack', () => {
  assert.deepEqual(stackAt([{ step: 1, op: 'assign', vars: {}, highlights: [], description: '' }], 0), []);
  assert.deepEqual(stackAt([], 0), []);
});

test('changes count only inside one call', () => {
  const events = [ev(1, 1, { i: 0 }), ev(2, 1, { i: 0 }), ev(3, 1, { i: 1 }), ev(4, 2, { i: 9 }), ev(5, 2, { i: 9 }), ev(6, 2, { i: 10 })];
  const flags = changeFlags(events);
  assert.deepEqual([...flags], [0, 0, 1, 0, 0, 1]);
  assert.equal(nextChange(flags, 0, 1), 2);
  assert.equal(nextChange(flags, 2, 1), 5);
  assert.equal(nextChange(flags, 5, 1), null);
  assert.equal(nextChange(flags, 5, -1), 2);
  assert.equal(nextChange(flags, 1, -1), null);
});

test('tree dumps round-trip through build and dump', () => {
  const whole = [3, 9, 20, null, null, 15, 7];
  assert.deepEqual(dumpTree(buildTree(whole)), whole);
  assert.deepEqual(dumpTree(buildTree(whole).right), [20, 15, 7]);
});

test('each recursive call is followed down the tree', () => {
  const whole = [3, 9, 20, null, null, 15, 7];
  // maxDepth(3) -> maxDepth(20) -> maxDepth(15)
  const path = followTree(whole, [whole, [20, 15, 7], [15]]);
  assert.deepEqual(path, { path: [0, 2, 5], atEmptyChild: false });
  // A call on an empty child stays on its parent.
  assert.deepEqual(followTree(whole, [whole, [9], []]), { path: [0, 1], atEmptyChild: true });
});

test('a path that cannot be followed is rejected rather than guessed', () => {
  const whole = [3, 9, 20];
  assert.equal(followTree(whole, [[1, 2, 3]]), null);
  assert.deepEqual(followTree(whole, [whole, [99]]), { path: [0], atEmptyChild: false });
});
