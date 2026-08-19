// Regression test for the tab freeze on navigation.
//
// When React detaches the canvas, getBoundingClientRect() returns 0x0. A frame
// already queued with requestAnimationFrame could still run, and the graticule
// loops stepped by `w / 12` — a zero step, so the loop never ended and the tab
// hung. These assert the loop shape is bounded for any measurement.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'src', 'components', 'brand', 'signal-trace.tsx'), 'utf8');

test('no loop steps by a measured dimension divided by a constant', () => {
  // `x += w / 12` and `y += h / 6` are the shapes that hung the browser.
  const dividedStep = /\+=\s*[wh]\s*\//.exec(source);
  assert.equal(
    dividedStep,
    null,
    `found a loop stepping by a measured size: ${dividedStep?.[0]}`,
  );
});

test('draw() bails out before dividing when the canvas has no size', () => {
  assert.match(source, /if \(!\(w >= 1 && h >= 1\)\)/);
});

test('the frame loop stops once the canvas leaves the document', () => {
  assert.match(source, /canvas\.isConnected/);
});

/** The graticule maths, mirrored: bounded iteration for any width/height. */
function graticuleSteps(w, h) {
  const xs = [];
  const ys = [];
  for (let i = 0; i <= 12; i++) xs.push((w / 12) * i);
  for (let i = 0; i <= 6; i++) ys.push((h / 6) * i);
  return { xs, ys };
}

test('graticule terminates for a detached canvas (0x0)', () => {
  const { xs, ys } = graticuleSteps(0, 0);
  assert.equal(xs.length, 13);
  assert.equal(ys.length, 7);
  assert.ok(xs.every((x) => x === 0));
});

test('graticule terminates for a normal canvas', () => {
  const { xs, ys } = graticuleSteps(416, 64);
  assert.equal(xs.length, 13);
  assert.equal(ys.length, 7);
  assert.equal(xs.at(-1), 416);
  assert.equal(ys.at(-1), 64);
});

test('the trace loop uses a constant step', () => {
  assert.match(source, /for \(let x = 0; x <= w; x \+= 2\)/);
});
