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
  pickArray,
  short,
} from '../draw';
import { useCanvas } from '../use-canvas';
import type { RendererProps } from '../types';

/**
 * Nodes as rounded rects joined by arrows, wrapping onto rows when the list is
 * long. The tracer serialises a ListNode chain to an array of values, so a
 * reversal shows up as the order flipping between steps.
 */
export function LinkedListView({ event, plan, previous }: RendererProps) {
  const canvasRef = useCanvas(
    (ctx, width, height) => {
      const vars = event?.vars ?? {};
      const list =
        pickArray(vars, ['head', 'node', 'cur', 'curr', 'current', 'prev', ...plan.paramNames]) ??
        pickArray(vars, plan.paramNames);

      if (!list) {
        emptyState(ctx, width, height, event ? 'no list in scope at this step' : 'run to trace');
        return;
      }

      const values = list.values.slice(0, 40);
      if (values.length === 0) {
        emptyState(ctx, width, height, `${list.name} is empty (null)`);
        return;
      }

      const nodeWidth = 54;
      const nodeHeight = 34;
      const gapX = 34;
      const gapY = 54;
      const perRow = Math.max(1, Math.floor((width - 32) / (nodeWidth + gapX)));
      const rows = Math.ceil(values.length / perRow);
      const startY = Math.max(30, height / 2 - ((rows - 1) * gapY + nodeHeight) / 2);

      const before = previous ? pickArray(previous.vars, [list.name])?.values : undefined;
      const reordered =
        before !== undefined &&
        before.length === values.length &&
        JSON.stringify(before) !== JSON.stringify(values);

      const opColour = OP_COLOUR[event?.op ?? 'visit'] ?? PALETTE.violetLit;
      const cursor = event?.highlights?.[0];

      label(ctx, list.name, 16, startY - 22, { colour: PALETTE.muted, font: MONO, align: 'left' });

      const positionOf = (index: number) => {
        const row = Math.floor(index / perRow);
        const column = index % perRow;
        const rowCount = Math.min(perRow, values.length - row * perRow);
        const rowWidth = rowCount * nodeWidth + (rowCount - 1) * gapX;
        const offsetX = Math.max(16, (width - rowWidth) / 2);
        return { x: offsetX + column * (nodeWidth + gapX), y: startY + row * gapY };
      };

      // Connectors first, so the node boxes sit on top of the arrowheads.
      values.forEach((_, index) => {
        if (index === values.length - 1) return;
        const from = positionOf(index);
        const to = positionOf(index + 1);

        if (to.y === from.y) {
          arrow(
            ctx,
            from.x + nodeWidth + 3,
            from.y + nodeHeight / 2,
            to.x - 4,
            to.y + nodeHeight / 2,
            reordered ? `${PALETTE.violetLit}99` : PALETTE.faint,
          );
        } else {
          // Wrap: drop out of the right edge and back in on the left.
          ctx.strokeStyle = PALETTE.faint;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(from.x + nodeWidth + 3, from.y + nodeHeight / 2);
          ctx.lineTo(from.x + nodeWidth + 14, from.y + nodeHeight / 2);
          ctx.lineTo(from.x + nodeWidth + 14, from.y + nodeHeight + 10);
          ctx.lineTo(to.x - 14, from.y + nodeHeight + 10);
          ctx.lineTo(to.x - 14, to.y + nodeHeight / 2);
          ctx.stroke();
          arrow(ctx, to.x - 14, to.y + nodeHeight / 2, to.x - 4, to.y + nodeHeight / 2, PALETTE.faint);
        }
      });

      values.forEach((value, index) => {
        const { x, y } = positionOf(index);
        const isCursor = cursor === index;
        const isHead = index === 0;

        cell(ctx, x, y, nodeWidth, nodeHeight, {
          fill: isCursor ? `${opColour}22` : '#ffffff08',
          stroke: isCursor ? `${opColour}88` : PALETTE.line,
          glow: isCursor ? opColour : undefined,
          radius: 8,
        });
        label(ctx, short(value, 5), x + nodeWidth / 2, y + nodeHeight / 2, {
          colour: isCursor ? PALETTE.paper : PALETTE.muted,
          font: MONO,
        });

        if (isHead) {
          label(ctx, 'head', x + nodeWidth / 2, y - 12, {
            colour: PALETTE.brassLit,
            font: MONO_SMALL,
          });
        }
        if (index === values.length - 1) {
          label(ctx, '→ null', x + nodeWidth + 20, y + nodeHeight / 2, {
            colour: PALETTE.faint,
            font: MONO_SMALL,
            align: 'left',
          });
        }
      });

      if (reordered) {
        label(ctx, 'order changed', width / 2, height - 12, {
          colour: PALETTE.violetLit,
          font: MONO_SMALL,
        });
      }
    },
    [event, previous, plan.paramNames.join(',')],
  );

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
