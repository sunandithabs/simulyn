'use client';

import {
  arrow,
  cell,
  emptyState,
  label,
  MONO,
  MONO_SMALL,
  OP_COLOUR,
  PALETTE,
  pickMatrix,
  short,
} from '../draw';
import { useCanvas } from '../use-canvas';
import type { RendererProps } from '../types';

/**
 * Grid of cells. Serves both the island/matrix problems and DP tables — for a
 * DP table the dependency arrows into the cell being filled are drawn, which is
 * the part students actually need to see.
 */
export function MatrixView({ event, plan, previous }: RendererProps) {
  const isDp = plan.kind === 'matrix';

  const canvasRef = useCanvas(
    (ctx, width, height) => {
      const vars = event?.vars ?? {};
      const matrix = pickMatrix(vars, plan.paramNames);

      if (!matrix) {
        emptyState(ctx, width, height, event ? 'no grid in scope at this step' : 'run to trace');
        return;
      }

      const rows = matrix.rows.slice(0, 20);
      const columns = Math.min(Math.max(...rows.map((row) => row.length)), 24);
      if (columns === 0) {
        emptyState(ctx, width, height, `${matrix.name} is empty`);
        return;
      }

      const gap = 3;
      const available = Math.min((width - 48) / columns, (height - 64) / rows.length);
      const size = Math.max(16, Math.min(46, Math.floor(available) - gap));
      const gridWidth = columns * (size + gap) - gap;
      const gridHeight = rows.length * (size + gap) - gap;
      const startX = Math.max(28, (width - gridWidth) / 2);
      const startY = Math.max(30, (height - gridHeight) / 2);

      const before = previous ? pickMatrix(previous.vars, [matrix.name])?.rows : undefined;
      const opColour = OP_COLOUR[event?.op ?? 'assign'] ?? PALETTE.violetLit;
      const highlights = new Set(event?.highlights ?? []);

      label(ctx, matrix.name, startX, startY - 18, {
        colour: PALETTE.muted,
        font: MONO,
        align: 'left',
      });

      // Column and row rails.
      for (let c = 0; c < columns; c++) {
        label(ctx, String(c), startX + c * (size + gap) + size / 2, startY - 6, {
          colour: PALETTE.faint,
          font: MONO_SMALL,
        });
      }

      let changedCell: { r: number; c: number } | null = null;

      rows.forEach((row, r) => {
        label(ctx, String(r), startX - 14, startY + r * (size + gap) + size / 2, {
          colour: PALETTE.faint,
          font: MONO_SMALL,
        });

        for (let c = 0; c < columns; c++) {
          const value = row[c];
          const x = startX + c * (size + gap);
          const y = startY + r * (size + gap);

          const changed =
            before !== undefined &&
            before[r] !== undefined &&
            JSON.stringify(before[r][c]) !== JSON.stringify(value);
          if (changed && !changedCell) changedCell = { r, c };

          // Highlights arrive as flat indices; treat them as row or column hits.
          const isHighlighted = highlights.has(r) || highlights.has(c);

          // "1" in an island grid, or a non-zero DP entry, reads as filled.
          const filled = value === '1' || value === 1 || (typeof value === 'number' && value > 0);

          cell(ctx, x, y, size, size, {
            fill: changed
              ? `${PALETTE.trace}2a`
              : filled
                ? `${PALETTE.violet}26`
                : isHighlighted
                  ? `${opColour}16`
                  : '#ffffff06',
            stroke: changed
              ? `${PALETTE.trace}88`
              : isHighlighted
                ? `${opColour}66`
                : PALETTE.lineFaint,
            glow: changed ? PALETTE.trace : undefined,
            radius: 4,
          });

          if (size >= 20) {
            label(ctx, short(value, size >= 34 ? 4 : 2), x + size / 2, y + size / 2, {
              colour: changed || filled ? PALETTE.paper : PALETTE.faint,
              font: MONO_SMALL,
            });
          }
        }
      });

      // Dependency arrows: a DP cell is normally built from the neighbours
      // above and to the left, so show where the new value came from.
      if (isDp && changedCell) {
        const { r, c } = changedCell as { r: number; c: number };
        const target = {
          x: startX + c * (size + gap) + size / 2,
          y: startY + r * (size + gap) + size / 2,
        };
        const sources = [
          { r: r - 1, c },
          { r, c: c - 1 },
          { r: r - 1, c: c - 1 },
        ].filter((source) => source.r >= 0 && source.c >= 0);

        for (const source of sources) {
          arrow(
            ctx,
            startX + source.c * (size + gap) + size / 2,
            startY + source.r * (size + gap) + size / 2,
            target.x,
            target.y,
            `${PALETTE.brass}77`,
          );
        }
      }

      if (matrix.rows.length > rows.length || columns < Math.max(...matrix.rows.map((r) => r.length))) {
        label(ctx, `showing ${rows.length}×${columns} of the grid`, width / 2, height - 10, {
          colour: PALETTE.faint,
          font: MONO_SMALL,
        });
      }
    },
    [event, previous, plan.kind, plan.paramNames.join(',')],
  );

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
