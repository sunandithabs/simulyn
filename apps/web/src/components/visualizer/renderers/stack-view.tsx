'use client';

import {
  cell,
  emptyState,
  label,
  MONO,
  MONO_SMALL,
  PALETTE,
  pickArray,
  pickString,
  short,
} from '../draw';
import { useCanvas } from '../use-canvas';
import type { RendererProps } from '../types';

const OPENERS = '([{';
const CLOSERS = ')]}';

/**
 * Vertical stack that grows upward, with the input string shown alongside for
 * bracket-matching problems — the pairing is the whole point there.
 */
export function StackView({ event, plan, previous }: RendererProps) {
  const canvasRef = useCanvas(
    (ctx, width, height) => {
      const vars = event?.vars ?? {};
      const stack = pickArray(vars, ['stack', ...plan.paramNames]);
      const input = pickString(vars, plan.paramNames);

      if (!stack && !input) {
        emptyState(ctx, width, height, event ? 'no stack in scope at this step' : 'run to trace');
        return;
      }

      const hasInput = Boolean(input);
      const stackColumnWidth = hasInput ? Math.min(200, width * 0.42) : width;
      const stackCentre = stackColumnWidth / 2;

      const values = (stack?.values ?? []).slice(-14);
      const slotWidth = Math.min(120, stackColumnWidth - 48);
      const slotHeight = 26;
      const gap = 4;
      const baseY = height - 34;

      const previousDepth = previous ? (pickArray(previous.vars, ['stack'])?.values.length ?? 0) : 0;
      const grew = values.length > previousDepth;
      const shrank = values.length < previousDepth;

      // Baseline the stack sits on.
      ctx.strokeStyle = PALETTE.line;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(stackCentre - slotWidth / 2 - 8, baseY + 6);
      ctx.lineTo(stackCentre + slotWidth / 2 + 8, baseY + 6);
      ctx.stroke();
      label(ctx, stack ? stack.name : 'stack', stackCentre, baseY + 20, {
        colour: PALETTE.muted,
        font: MONO_SMALL,
      });

      values.forEach((value, index) => {
        const y = baseY - (index + 1) * (slotHeight + gap);
        const isTop = index === values.length - 1;
        const flash = isTop && grew ? PALETTE.trace : isTop && shrank ? PALETTE.fault : undefined;

        cell(ctx, stackCentre - slotWidth / 2, y, slotWidth, slotHeight, {
          fill: isTop ? `${PALETTE.violet}28` : '#ffffff08',
          stroke: isTop ? `${PALETTE.violetLit}66` : PALETTE.line,
          glow: flash ?? (isTop ? PALETTE.violet : undefined),
        });
        label(ctx, short(value, 10), stackCentre, y + slotHeight / 2, {
          colour: isTop ? PALETTE.paper : PALETTE.muted,
          font: MONO,
        });

        if (isTop) {
          label(ctx, '← top', stackCentre + slotWidth / 2 + 22, y + slotHeight / 2, {
            colour: PALETTE.brassLit,
            font: MONO_SMALL,
            align: 'left',
          });
        }
      });

      if (values.length === 0) {
        label(ctx, 'empty', stackCentre, baseY - 20, { colour: PALETTE.faint, font: MONO_SMALL });
      }

      if (!hasInput || !input) return;

      // Bracket matching: the input laid out left to right, consumed so far
      // shaded, the character under the cursor lit.
      const chars = [...input.value].slice(0, 40);
      const left = stackColumnWidth + 16;
      const available = width - left - 16;
      const size = Math.max(16, Math.min(30, Math.floor(available / Math.max(chars.length, 1)) - 4));
      const cursor = event?.highlights?.[0];

      label(ctx, input.name, left, 22, { colour: PALETTE.muted, font: MONO, align: 'left' });

      chars.forEach((char, index) => {
        const x = left + index * (size + 4);
        const y = height / 2 - size / 2;
        const isCursor = cursor === index;
        const isOpener = OPENERS.includes(char);
        const isCloser = CLOSERS.includes(char);
        const tint = isOpener ? PALETTE.trace : isCloser ? PALETTE.brassLit : PALETTE.muted;

        cell(ctx, x, y, size, size, {
          fill: isCursor ? `${PALETTE.warn}22` : '#ffffff06',
          stroke: isCursor ? `${PALETTE.warn}88` : PALETTE.lineFaint,
          glow: isCursor ? PALETTE.warn : undefined,
          radius: 5,
        });
        label(ctx, char, x + size / 2, y + size / 2, {
          colour: isCursor ? PALETTE.paper : tint,
          font: MONO,
        });
      });
    },
    [event, previous, plan.paramNames.join(',')],
  );

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
