'use client';

import { emptyState, label, MONO, MONO_SMALL, OP_COLOUR, PALETTE, short } from '../draw';
import { useCanvas } from '../use-canvas';
import type { RendererProps } from '../types';

interface Node {
  value: unknown;
  index: number;
  depth: number;
  x: number;
  y: number;
  left?: Node;
  right?: Node;
}

/**
 * Rebuilds the tree from the level-order array the tracer emits (nulls mark
 * missing children), then lays it out by level with in-order horizontal
 * spacing so subtrees never overlap.
 */
function build(levelOrder: unknown[]): Node | null {
  if (levelOrder.length === 0 || levelOrder[0] === null || levelOrder[0] === undefined) return null;

  const root: Node = { value: levelOrder[0], index: 0, depth: 0, x: 0, y: 0 };
  const queue: Node[] = [root];
  let cursor = 1;
  let head = 0;

  while (head < queue.length && cursor < levelOrder.length) {
    const node = queue[head++];

    for (const side of ['left', 'right'] as const) {
      if (cursor >= levelOrder.length) break;
      const value = levelOrder[cursor];
      const index = cursor;
      cursor += 1;
      if (value === null || value === undefined) continue;

      const child: Node = { value, index, depth: node.depth + 1, x: 0, y: 0 };
      node[side] = child;
      queue.push(child);
    }
  }

  return root;
}

/** In-order walk assigns each node its own column — the classic clean layout. */
function layout(root: Node): { nodes: Node[]; columns: number; depth: number } {
  const nodes: Node[] = [];
  let column = 0;
  let deepest = 0;

  const walk = (node: Node | undefined) => {
    if (!node) return;
    walk(node.left);
    node.x = column++;
    deepest = Math.max(deepest, node.depth);
    nodes.push(node);
    walk(node.right);
  };

  walk(root);
  return { nodes, columns: column, depth: deepest };
}

export function TreeView({ event, plan, previous }: RendererProps) {
  const canvasRef = useCanvas(
    (ctx, width, height) => {
      const vars = event?.vars ?? {};

      // A serialised tree is an array that contains nulls, or the named param.
      const candidates = [...plan.paramNames, 'root', 'node', 'tree'];
      let levelOrder: unknown[] | null = null;
      let name = 'tree';

      for (const key of candidates) {
        if (Array.isArray(vars[key])) {
          levelOrder = vars[key] as unknown[];
          name = key;
          break;
        }
      }
      if (!levelOrder) {
        for (const [key, value] of Object.entries(vars)) {
          if (Array.isArray(value) && value.some((v) => v === null)) {
            levelOrder = value;
            name = key;
            break;
          }
        }
      }

      if (!levelOrder) {
        emptyState(ctx, width, height, event ? 'no tree in scope at this step' : 'run to trace');
        return;
      }

      const root = build(levelOrder.slice(0, 63));
      if (!root) {
        emptyState(ctx, width, height, `${name} is empty`);
        return;
      }

      const { nodes, columns, depth } = layout(root);
      const radius = Math.max(13, Math.min(20, Math.floor((width - 40) / (columns * 2.4))));
      const levelHeight = Math.min(70, Math.max(44, (height - 60) / Math.max(depth, 1)));
      const spanX = (width - 48) / Math.max(columns - 1, 1);
      const topY = 34;

      const place = (node: Node) => ({
        x: 24 + node.x * spanX,
        y: topY + node.depth * levelHeight,
      });

      const before = previous
        ? (Object.entries(previous.vars).find(([key]) => key === name)?.[1] as unknown[] | undefined)
        : undefined;
      const opColour = OP_COLOUR[event?.op ?? 'visit'] ?? PALETTE.violetLit;
      const highlights = new Set(event?.highlights ?? []);

      label(ctx, name, 16, 16, { colour: PALETTE.muted, font: MONO, align: 'left' });

      // Edges first.
      for (const node of nodes) {
        const from = place(node);
        for (const side of ['left', 'right'] as const) {
          const child = node[side];
          if (!child) continue;
          const to = place(child);
          ctx.strokeStyle = PALETTE.lineFaint;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y + radius * 0.7);
          ctx.lineTo(to.x, to.y - radius * 0.7);
          ctx.stroke();
        }
      }

      for (const node of nodes) {
        const { x, y } = place(node);
        const isHighlighted = highlights.has(node.index) || highlights.has(Number(node.value));
        const changed =
          before !== undefined && JSON.stringify(before[node.index]) !== JSON.stringify(node.value);

        // Depth tints the fill, so subtrees read apart at a glance.
        const tint = [PALETTE.violetLit, PALETTE.brassLit, PALETTE.trace, PALETTE.muted][
          node.depth % 4
        ];

        ctx.save();
        if (isHighlighted || changed) {
          ctx.shadowColor = isHighlighted ? opColour : PALETTE.trace;
          ctx.shadowBlur = 16;
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isHighlighted ? `${opColour}33` : `${tint}14`;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isHighlighted ? `${opColour}aa` : `${tint}55`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        label(ctx, short(node.value, 4), x, y, {
          colour: isHighlighted ? PALETTE.paper : PALETTE.muted,
          font: MONO,
        });
      }

      label(ctx, `${nodes.length} nodes · depth ${depth + 1}`, width / 2, height - 12, {
        colour: PALETTE.faint,
        font: MONO_SMALL,
      });
    },
    [event, previous, plan.paramNames.join(',')],
  );

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
