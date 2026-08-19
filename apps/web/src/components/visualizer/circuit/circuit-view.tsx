'use client';

import { useEffect, useRef, useState } from 'react';

import { label, MONO_SMALL, PALETTE } from '../draw';
import { useAnimatedCanvas } from '../use-canvas';
import { buildSchematic, type Schematic } from './templates';
import { drawSymbol, symbolRadius, type CircuitElement, type Point } from './symbols';

export type ProbeState = Record<string, 'correct' | 'wrong'>;

/** Blue at ground, red at the supply rail. */
function potentialColour(potential: number, alpha = 1): string {
  const clamped = Math.min(1, Math.max(0, potential));
  const r = Math.round(60 + clamped * 190);
  const g = Math.round(90 + (1 - Math.abs(clamped - 0.5) * 2) * 60);
  const b = Math.round(240 - clamped * 190);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Tooltip {
  x: number;
  y: number;
  name: string;
  value: string;
}

/**
 * Draws the circuit a problem describes, straight from its `params`.
 *
 * Current is shown as dots travelling along the wires, and each wire is tinted
 * by its potential. Probe points glow green or red once the matching answer has
 * been checked, so a student sees *where* on the circuit they were wrong.
 */
export function CircuitView({
  category,
  params,
  probes = {},
  className,
}: {
  category: string;
  params: Record<string, unknown> | null;
  probes?: ProbeState;
  className?: string;
}) {
  const [schematic, setSchematic] = useState<Schematic | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const geometry = useRef<{ scale: number; offsetX: number; offsetY: number }>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    setSchematic(buildSchematic(category, params));
  }, [category, params]);

  const probesRef = useRef(probes);
  probesRef.current = probes;
  const schematicRef = useRef(schematic);
  schematicRef.current = schematic;

  const canvasRef = useAnimatedCanvas((ctx, width, height, time) => {
    const plan = schematicRef.current;
    if (!plan) {
      label(ctx, 'no diagram for this circuit', width / 2, height / 2, {
        colour: PALETTE.faint,
        font: MONO_SMALL,
      });
      return;
    }

    // The schematic is authored in a 0–100 box; fit it with a margin.
    const margin = 22;
    const scale = Math.min((width - margin * 2) / 100, (height - margin * 2) / 100);
    const offsetX = (width - 100 * scale) / 2;
    const offsetY = (height - 100 * scale) / 2;
    geometry.current = { scale, offsetX, offsetY };

    const toCanvas = (point: Point) => ({
      x: offsetX + point.x * scale,
      y: offsetY + point.y * scale,
    });

    // ── wires, tinted by potential ──
    for (const wire of plan.wires) {
      const points = wire.points.map(toCanvas);
      ctx.strokeStyle = potentialColour(wire.potential, 0.75);
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();

      // Junction dots wherever a wire changes direction.
      for (const point of points.slice(1, -1)) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = potentialColour(wire.potential, 0.9);
        ctx.fill();
      }
    }

    // ── current flow ──
    for (const wire of plan.wires) {
      const points = wire.points.map(toCanvas);
      let total = 0;
      const spans: number[] = [];
      for (let i = 1; i < points.length; i++) {
        const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        spans.push(d);
        total += d;
      }
      if (total < 1) continue;

      const spacing = 34;
      const count = Math.max(1, Math.floor(total / spacing));
      for (let i = 0; i < count; i++) {
        const travelled = ((time * 32 + (i * total) / count) % total);
        let remaining = travelled;
        let segment = 0;
        while (segment < spans.length && remaining > spans[segment]) {
          remaining -= spans[segment];
          segment += 1;
        }
        if (segment >= spans.length) continue;

        const t = spans[segment] === 0 ? 0 : remaining / spans[segment];
        const from = points[segment];
        const to = points[segment + 1];
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.brassLit;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // ── components ──
    for (const element of plan.elements) {
      const { x, y } = toCanvas(element.at);
      const size = (element.span ?? 9) * scale;

      ctx.save();
      ctx.translate(x, y);
      if (element.rotation === 90) ctx.rotate(Math.PI / 2);
      drawSymbol(ctx, element, size, PALETTE.paper);
      ctx.restore();

      const textY = element.rotation === 90 ? y : y - size - 8;
      const textX = element.rotation === 90 ? x + size + 12 : x;
      const align = element.rotation === 90 ? 'left' : 'center';

      if (element.name !== 'GND') {
        label(ctx, element.name, textX, textY, {
          colour: PALETTE.brassLit,
          font: MONO_SMALL,
          align,
        });
        if (element.value) {
          label(ctx, element.value, textX, textY + 12, {
            colour: PALETTE.muted,
            font: MONO_SMALL,
            align,
          });
        }
      }
    }

    // ── probe points ──
    for (const [id, probe] of Object.entries(plan.probes)) {
      const { x, y } = toCanvas(probe.at);
      const state = probesRef.current[id];
      const colour =
        state === 'correct' ? PALETTE.trace : state === 'wrong' ? PALETTE.fault : PALETTE.faint;

      // A checked probe pulses; an unchecked one is a quiet ring.
      const pulse = state ? 0.5 + 0.5 * Math.sin(time * 3) : 0;

      ctx.save();
      if (state) {
        ctx.shadowColor = colour;
        ctx.shadowBlur = 10 + pulse * 12;
      }
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = state ? colour : 'transparent';
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.5;
      if (state) ctx.fill();
      ctx.stroke();
      ctx.restore();

      label(ctx, probe.label, x, y - 14, { colour, font: MONO_SMALL });
    }
  });

  /** Click a component to read its value. */
  function onClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const plan = schematicRef.current;
    const canvas = canvasRef.current;
    if (!plan || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const { scale, offsetX, offsetY } = geometry.current;

    for (const element of plan.elements) {
      const x = offsetX + element.at.x * scale;
      const y = offsetY + element.at.y * scale;
      const radius = symbolRadius(element.kind, (element.span ?? 9) * scale) + 6;

      if (Math.hypot(px - x, py - y) <= radius) {
        setTooltip({
          x: px,
          y: py,
          name: element.name,
          value: element.value ?? element.kind,
        });
        return;
      }
    }
    setTooltip(null);
  }

  return (
    <div className={className}>
      <div className="relative h-full w-full">
        <canvas
          ref={canvasRef}
          onClick={onClick}
          className="block h-full w-full cursor-crosshair"
          aria-label={schematic ? `Schematic: ${schematic.title}` : 'Circuit schematic'}
        />

        {schematic ? (
          <span className="pointer-events-none absolute top-2 left-3 font-mono text-[10px] tracking-[0.08em] text-faint uppercase">
            {schematic.title}
          </span>
        ) : null}

        {tooltip ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-ink-sunken px-2.5 py-1.5 whitespace-nowrap shadow-xl"
            style={{ left: tooltip.x, top: tooltip.y - 10 }}
          >
            <div className="font-mono text-[11px] text-brass-lit">{tooltip.name}</div>
            <div className="font-mono text-[11px] text-paper">{tooltip.value}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { buildSchematic };
export type { CircuitElement };
