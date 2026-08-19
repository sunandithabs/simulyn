/**
 * Shared canvas helpers.
 *
 * Canvas cannot read CSS custom properties, so the design tokens from
 * globals.css are mirrored here as literals. Keep them in step with `@theme`.
 */
export const PALETTE = {
  ink: '#0a0a14',
  raised: '#11111f',
  sunken: '#07070f',
  violet: '#7352b8',
  violetLit: '#a78bfa',
  brass: '#c7a346',
  brassLit: '#e8cc80',
  paper: '#e9e9f2',
  muted: '#8b8ba7',
  faint: '#5a5a75',
  trace: '#4ade80',
  fault: '#fb7185',
  warn: '#fbbf24',
  line: '#ffffff22',
  lineFaint: '#ffffff12',
} as const;

/** State colours the brief pins down: compare amber, swap violet, done green. */
export const OP_COLOUR: Record<string, string> = {
  compare: PALETTE.warn,
  swap: PALETTE.violetLit,
  assign: PALETTE.violetLit,
  push: PALETTE.trace,
  pop: PALETTE.fault,
  visit: PALETTE.brassLit,
  return: PALETTE.trace,
};

export const MONO = '12px ui-monospace, "JetBrains Mono", monospace';
export const MONO_SMALL = '10px ui-monospace, "JetBrains Mono", monospace';

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Box with an optional glow, used for every cell, node and stack slot. */
export function cell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  options: { fill?: string; stroke?: string; glow?: string; radius?: number } = {},
): void {
  const { fill = '#ffffff08', stroke = PALETTE.line, glow, radius = 6 } = options;

  ctx.save();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
  }
  roundedRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, x, y, w, h, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { colour?: string; font?: string; align?: CanvasTextAlign } = {},
): void {
  const { colour = PALETTE.muted, font = MONO_SMALL, align = 'center' } = options;
  ctx.font = font;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export function arrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  // Typed wide: PALETTE is `as const`, so an inferred default would narrow
  // this to that one literal colour.
  colour: string = PALETTE.faint,
): void {
  const head = 6;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

/** Downward marker used for two-pointer and sliding-window labels. */
export function pointer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  colour: string = PALETTE.brassLit,
): void {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x, y + 7);
  ctx.lineTo(x - 5, y);
  ctx.lineTo(x + 5, y);
  ctx.closePath();
  ctx.fill();
  label(ctx, text, x, y - 8, { colour, font: MONO_SMALL });
}

export function emptyState(ctx: CanvasRenderingContext2D, w: number, h: number, text: string): void {
  label(ctx, text, w / 2, h / 2, { colour: PALETTE.faint, font: MONO });
}

/** Shortens a value for display inside a cell. */
export function short(value: unknown, max = 6): string {
  if (value === null || value === undefined) return '·';
  if (typeof value === 'string') return value.length > max ? `${value.slice(0, max)}…` : value;
  if (typeof value === 'number') {
    const text = String(value);
    return text.length > max + 2 ? value.toExponential(1) : text;
  }
  if (typeof value === 'boolean') return value ? 'T' : 'F';
  if (Array.isArray(value)) return `[${value.length}]`;
  return '·';
}

// ── reading trace variables ────────────────────────────────────────────

/** First variable that is an array, preferring the harness parameter names. */
export function pickArray(
  vars: Record<string, unknown>,
  preferred: string[] = [],
): { name: string; values: unknown[] } | null {
  for (const name of preferred) {
    const value = vars[name];
    if (Array.isArray(value)) return { name, values: value };
  }
  for (const [name, value] of Object.entries(vars)) {
    if (Array.isArray(value) && value.every((v) => !Array.isArray(v))) return { name, values: value };
  }
  return null;
}

/** First variable that is an array of arrays — a grid or a DP table. */
export function pickMatrix(
  vars: Record<string, unknown>,
  preferred: string[] = [],
): { name: string; rows: unknown[][] } | null {
  const isMatrix = (value: unknown): value is unknown[][] =>
    Array.isArray(value) && value.length > 0 && value.every((row) => Array.isArray(row));

  for (const name of preferred) {
    if (isMatrix(vars[name])) return { name, rows: vars[name] as unknown[][] };
  }
  for (const [name, value] of Object.entries(vars)) {
    if (isMatrix(value)) return { name, rows: value };
  }
  return null;
}

export function pickString(
  vars: Record<string, unknown>,
  preferred: string[] = [],
): { name: string; value: string } | null {
  for (const name of preferred) {
    if (typeof vars[name] === 'string') return { name, value: vars[name] as string };
  }
  for (const [name, value] of Object.entries(vars)) {
    if (typeof value === 'string' && value.length > 0) return { name, value };
  }
  return null;
}

/** Named integers that are plausibly indices, for pointer markers. */
export function pickPointers(vars: Record<string, unknown>, limit: number): [string, number][] {
  const known = new Set([
    'i', 'j', 'k', 'l', 'r', 'lo', 'hi', 'mid', 'left', 'right', 'start', 'end',
    'idx', 'index', 'p', 'q', 'fast', 'slow', 'pos', 'top',
  ]);

  return Object.entries(vars)
    .filter(
      ([name, value]) =>
        known.has(name) &&
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 0 &&
        value < limit,
    )
    .map(([name, value]) => [name, value as number] as [string, number]);
}

/** Values that differ from the previous step — the inspector flashes these. */
export function changedKeys(
  current: Record<string, unknown>,
  previous: Record<string, unknown> | undefined,
): Set<string> {
  const changed = new Set<string>();
  if (!previous) return changed;

  for (const [key, value] of Object.entries(current)) {
    if (JSON.stringify(value) !== JSON.stringify(previous[key])) changed.add(key);
  }
  return changed;
}
