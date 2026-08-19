'use client';

import {
  cell,
  emptyState,
  label,
  MONO,
  MONO_SMALL,
  OP_COLOUR,
  PALETTE,
  pickArray,
  pickPointers,
  pickString,
  short,
} from '../draw';
import { useCanvas } from '../use-canvas';
import type { RendererProps } from '../types';

/**
 * Horizontal indexed boxes.
 *
 * Doubles as the character view for string problems and the interval bar chart,
 * because they are the same layout with a different cell body.
 */
export function ArrayView({ event, plan, previous }: RendererProps & { variant?: 'values' | 'chars' }) {
  const variant = plan.kind === 'chars' ? 'chars' : 'values';

  const canvasRef = useCanvas(
    (ctx, width, height) => {
      const vars = event?.vars ?? {};

      const asString = variant === 'chars' ? pickString(vars, plan.paramNames) : null;
      const array = asString
        ? { name: asString.name, values: [...asString.value] as unknown[] }
        : pickArray(vars, plan.paramNames);

      if (!array || array.values.length === 0) {
        emptyState(ctx, width, height, event ? 'no array in scope at this step' : 'run to trace');
        return;
      }

      const values = array.values.slice(0, 64);
      const gap = 6;
      const maxWidth = width - 32;
      const size = Math.max(22, Math.min(54, Math.floor(maxWidth / values.length) - gap));
      const totalWidth = values.length * (size + gap) - gap;
      const startX = Math.max(16, (width - totalWidth) / 2);
      const y = Math.round(height / 2 - size / 2);

      const highlights = new Set(event?.highlights ?? []);
      const pointers = pickPointers(vars, values.length);
      const opColour = OP_COLOUR[event?.op ?? 'assign'] ?? PALETTE.violetLit;

      // Which cells changed since the previous step — those flash.
      const before = previous ? pickArray(previous.vars, plan.paramNames)?.values : undefined;

      label(ctx, array.name, startX, y - 30, { colour: PALETTE.muted, font: MONO, align: 'left' });

      values.forEach((value, index) => {
        const x = startX + index * (size + gap);
        const isHighlighted = highlights.has(index);
        const isChanged =
          before !== undefined &&
          JSON.stringify(before[index]) !== JSON.stringify(value) &&
          before.length === values.length;

        const glow = isHighlighted ? opColour : isChanged ? PALETTE.trace : undefined;
        const fill = isHighlighted
          ? `${opColour}22`
          : isChanged
            ? `${PALETTE.trace}1f`
            : '#ffffff08';

        cell(ctx, x, y, size, size, {
          fill,
          stroke: glow ? `${glow}88` : PALETTE.line,
          glow,
        });

        label(ctx, short(value, size > 34 ? 5 : 3), x + size / 2, y + size / 2, {
          colour: isHighlighted || isChanged ? PALETTE.paper : PALETTE.muted,
          font: MONO,
        });

        // Index rail under every cell.
        label(ctx, String(index), x + size / 2, y + size + 12, {
          colour: PALETTE.faint,
          font: MONO_SMALL,
        });
      });

      // Two-pointer and sliding-window markers, stacked so they never collide.
      pointers.slice(0, 4).forEach(([name, index], row) => {
        const x = startX + index * (size + gap) + size / 2;
        const markerY = y - 10 - row * 16;
        if (markerY > 6) {
          ctx.save();
          ctx.strokeStyle = `${PALETTE.brass}55`;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(x, markerY + 8);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.restore();
          // Draw after the guide so the label sits on top of it.
          const colour = row === 0 ? PALETTE.brassLit : PALETTE.violetLit;
          ctx.fillStyle = colour;
          ctx.beginPath();
          ctx.moveTo(x, markerY + 7);
          ctx.lineTo(x - 5, markerY);
          ctx.lineTo(x + 5, markerY);
          ctx.closePath();
          ctx.fill();
          label(ctx, name, x, markerY - 8, { colour, font: MONO_SMALL });
        }
      });

      // Window shading when two pointers bracket a range.
      if (pointers.length >= 2) {
        const [a, b] = [pointers[0][1], pointers[1][1]].sort((m, n) => m - n);
        if (b > a) {
          const x1 = startX + a * (size + gap);
          const x2 = startX + b * (size + gap) + size;
          ctx.fillStyle = `${PALETTE.violet}18`;
          ctx.fillRect(x1, y - 4, x2 - x1, size + 8);
        }
      }

      if (values.length < array.values.length) {
        label(ctx, `showing 64 of ${array.values.length}`, width / 2, height - 10, {
          colour: PALETTE.faint,
          font: MONO_SMALL,
        });
      }
    },
    [event, previous, plan.kind, plan.paramNames.join(',')],
  );

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
