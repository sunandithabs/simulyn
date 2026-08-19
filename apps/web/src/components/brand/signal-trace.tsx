'use client';

import { useEffect, useRef } from 'react';

/**
 * The signature element.
 *
 * A live oscilloscope trace that morphs between a square wave (the electronics
 * bench) and a smooth analogue wave (the code side), with the pointer nudging
 * the amplitude. The product is half circuits, half algorithms — this is the
 * one place the page says so without words.
 *
 * Falls back to a static path when the visitor prefers reduced motion.
 */
export function SignalTrace({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let raf = 0;
    let pointer = 0.5;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      // A detached or not-yet-laid-out canvas measures 0x0. Skip the frame
      // rather than drawing into nothing — every step below divides by these.
      if (!(w >= 1 && h >= 1)) {
        if (canvas.isConnected) raf = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      const mid = h / 2;
      const t = frame / 60;
      // Cross-fade between analogue and square every ~9 seconds.
      const blend = (Math.sin(t * 0.35) + 1) / 2;
      const amplitude = h * 0.17 * (0.7 + (1 - pointer) * 0.6);

      // Graticule: the faint measurement grid behind the trace. Fixed division
      // counts, so the step can never be zero.
      ctx.strokeStyle = '#ffffff0a';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        const x = (w / 12) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let i = 0; i <= 6; i++) {
        const y = (h / 6) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const pointAt = (x: number) => {
        const phase = (x / w) * Math.PI * 6 - t * 1.2;
        const analogue = Math.sin(phase);
        const square = Math.sign(Math.sin(phase)) * 0.85;
        return mid - (analogue * (1 - blend) + square * blend) * amplitude;
      };

      // Glow pass, then the crisp trace on top.
      for (const [width, colour, alpha] of [
        [7, '#a78bfa', 0.12],
        [1.6, '#e8cc80', 1],
      ] as const) {
        ctx.beginPath();
        ctx.lineWidth = width;
        ctx.strokeStyle = colour;
        ctx.globalAlpha = alpha;
        ctx.lineJoin = 'round';
        for (let x = 0; x <= w; x += 2) {
          const y = pointAt(x);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Sampling head: where the instrument is reading right now.
      const headX = ((t * 90) % (w + 120)) - 60;
      if (headX > 0 && headX < w) {
        const headY = pointAt(headX);
        ctx.beginPath();
        ctx.arc(headX, headY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#e8cc80';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(headX, headY, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#e8cc8022';
        ctx.fill();
      }

      frame += 1;
      // Stop scheduling once React has taken the canvas out of the document,
      // so the loop dies even if cleanup has not run yet.
      if (canvas.isConnected) raf = requestAnimationFrame(draw);
    };

    resize();
    if (reduced) {
      draw();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(draw);
      window.addEventListener('pointermove', onPointer);
    }
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
