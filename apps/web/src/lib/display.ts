/**
 * Is the exam window on, or spilling onto, a display other than the primary?
 *
 * Chromium answers directly via `screen.isExtended`. Everywhere else we fall
 * back to window geometry, using only unambiguous cases: the window's origin
 * sitting entirely past an edge of the primary display.
 *
 * Deliberately NOT using `screen.width > screen.availWidth` — that gap is the
 * taskbar, not a second monitor, and would accuse nearly every Windows student.
 *
 * Returns the reason a proctor would be shown, or null when nothing is off.
 */
export function detectExtendedDisplay(): string | null {
  if (typeof window === 'undefined' || !window.screen) return null;

  const screenDetail = window.screen as Screen & { isExtended?: boolean };
  if (screenDetail.isExtended === true) {
    return 'the browser reports an extended desktop';
  }

  const left = window.screenLeft ?? window.screenX;
  const top = window.screenTop ?? window.screenY;
  const { width, height } = window.screen;

  // A maximized window sits at roughly -8 on Windows, so only an origin fully
  // past an edge counts. Anything less is a normal single-screen position.
  if (Number.isFinite(left) && left >= width) {
    return 'the exam window is positioned past the right edge of the primary display';
  }
  if (Number.isFinite(left) && left + window.outerWidth <= 0) {
    return 'the exam window is positioned left of the primary display';
  }
  if (Number.isFinite(top) && top >= height) {
    return 'the exam window is positioned below the primary display';
  }

  return null;
}
