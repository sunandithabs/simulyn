// Verifies the multi-monitor heuristic against real-world window geometry —
// in particular that a taskbar or a snapped window is never mistaken for a
// second display. Run with: pnpm --filter web test
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { detectExtendedDisplay } = await import('../src/lib/display.ts');

/** Installs a fake window/screen for one assertion. */
function withWindow(shape, run) {
  globalThis.window = shape;
  try {
    return run();
  } finally {
    delete globalThis.window;
  }
}

const primary = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 };

test('single 1080p screen, window maximized -> clean', () => {
  const result = withWindow(
    { screen: { ...primary }, screenLeft: -8, screenTop: -8, outerWidth: 1936, outerHeight: 1096 },
    detectExtendedDisplay,
  );
  assert.equal(result, null);
});

test('taskbar present (availHeight < height) -> clean', () => {
  // This is the case the naive `screen.width > availWidth` check gets wrong.
  const result = withWindow(
    {
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
      screenLeft: 0,
      screenTop: 0,
      outerWidth: 1280,
      outerHeight: 1040,
    },
    detectExtendedDisplay,
  );
  assert.equal(result, null);
});

test('side taskbar (availWidth < width) -> clean', () => {
  const result = withWindow(
    {
      screen: { width: 1920, height: 1080, availWidth: 1848, availHeight: 1080 },
      screenLeft: 72,
      screenTop: 0,
      outerWidth: 1200,
      outerHeight: 900,
    },
    detectExtendedDisplay,
  );
  assert.equal(result, null);
});

test('window snapped to the right half -> clean', () => {
  const result = withWindow(
    { screen: { ...primary }, screenLeft: 960, screenTop: 0, outerWidth: 960, outerHeight: 1040 },
    detectExtendedDisplay,
  );
  assert.equal(result, null);
});

test('narrow window near the right edge -> clean', () => {
  const result = withWindow(
    { screen: { ...primary }, screenLeft: 1700, screenTop: 40, outerWidth: 220, outerHeight: 600 },
    detectExtendedDisplay,
  );
  assert.equal(result, null);
});

test('window dragged onto a second monitor to the right -> flagged', () => {
  const result = withWindow(
    { screen: { ...primary }, screenLeft: 1920, screenTop: 0, outerWidth: 1280, outerHeight: 900 },
    detectExtendedDisplay,
  );
  assert.match(result ?? '', /right edge/);
});

test('window on a second monitor to the left -> flagged', () => {
  const result = withWindow(
    { screen: { ...primary }, screenLeft: -1920, screenTop: 0, outerWidth: 1280, outerHeight: 900 },
    detectExtendedDisplay,
  );
  assert.match(result ?? '', /left of/);
});

test('window on a monitor stacked below -> flagged', () => {
  const result = withWindow(
    { screen: { ...primary }, screenLeft: 200, screenTop: 1080, outerWidth: 1280, outerHeight: 900 },
    detectExtendedDisplay,
  );
  assert.match(result ?? '', /below/);
});

test('Chromium reporting an extended desktop -> flagged even when centred', () => {
  const result = withWindow(
    {
      screen: { ...primary, isExtended: true },
      screenLeft: 100,
      screenTop: 100,
      outerWidth: 1280,
      outerHeight: 900,
    },
    detectExtendedDisplay,
  );
  assert.match(result ?? '', /extended desktop/);
});

test('Chromium explicitly reporting a single desktop -> clean', () => {
  const result = withWindow(
    {
      screen: { ...primary, isExtended: false },
      screenLeft: 100,
      screenTop: 100,
      outerWidth: 1280,
      outerHeight: 900,
    },
    detectExtendedDisplay,
  );
  assert.equal(result, null);
});

test('server-side render (no window) -> clean', () => {
  assert.equal(detectExtendedDisplay(), null);
});
