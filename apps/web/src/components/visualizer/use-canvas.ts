'use client';

import { useEffect, useRef } from 'react';

export type DrawFn = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/**
 * Canvas that keeps itself sized to its container and redraws when `draw`
 * changes.
 *
 * The zero-size guard is deliberate: a detached or not-yet-laid-out canvas
 * measures 0x0, and renderers divide by width and height to lay cells out.
 */
export function useCanvas(draw: DrawFn, deps: unknown[] = []) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      if (!(rect.width >= 1 && rect.height >= 1)) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawRef.current(ctx, width, height);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };

    schedule();

    const observer = new ResizeObserver(schedule);
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return canvasRef;
}

/**
 * Same idea, but redrawn every frame with a monotonically rising clock —
 * for the circuit's current flow and the oscilloscope sweep.
 */
export function useAnimatedCanvas(
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => void,
  running = true,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let start = performance.now();

    const render = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width >= 1 && rect.height >= 1) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);

        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        drawRef.current(ctx, width, height, (now - start) / 1000);
      }

      // Stop once React detaches the canvas, even before cleanup runs.
      if (canvas.isConnected && running && !reduced) frame = requestAnimationFrame(render);
    };

    start = performance.now();
    frame = requestAnimationFrame(render);

    const observer = new ResizeObserver(() => {
      if (!running || reduced) frame = requestAnimationFrame(render);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [running]);

  return canvasRef;
}
