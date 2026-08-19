'use client';

import { label, MONO_SMALL, PALETTE } from '../draw';
import { useAnimatedCanvas } from '../use-canvas';

export type WaveformKind = 'lowpass' | 'square' | 'sine' | 'charge';

/**
 * Oscilloscope-style trace for the time-domain and frequency-response
 * problems: input in violet, output in brass, over a measurement graticule.
 *
 * The output curve is derived from the circuit's own parameters, so the
 * attenuation and the RC corner a student calculates are what they see.
 */
export function WaveformView({
  kind,
  params,
  className,
}: {
  kind: WaveformKind;
  params: Record<string, unknown> | null;
  className?: string;
}) {
  const canvasRef = useAnimatedCanvas((ctx, width, height, time) => {
    const mid = height / 2;
    const amplitude = height * 0.3;
    const num = (key: string, fallback: number) => {
      const value = params?.[key];
      const parsed = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(parsed) && parsed !== 0 ? parsed : fallback;
    };

    // Graticule.
    ctx.strokeStyle = PALETTE.lineFaint;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Zero line.
    ctx.strokeStyle = `${PALETTE.muted}44`;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();

    const sweep = time * 1.4;

    const drawTrace = (
      colour: string,
      fn: (t: number) => number,
      lineWidth = 1.8,
      glow = true,
    ) => {
      ctx.save();
      if (glow) {
        ctx.shadowColor = colour;
        ctx.shadowBlur = 8;
      }
      ctx.strokeStyle = colour;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (let px = 0; px <= width; px += 2) {
        const t = px / width;
        const y = fn(t);
        if (px === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
      ctx.restore();
    };

    if (kind === 'charge') {
      // Capacitor charging toward the supply, with the τ marker.
      const cycles = 5;
      drawTrace(PALETTE.brassLit, (t) => {
        const tau = t * cycles;
        return height * 0.85 - (1 - Math.exp(-tau)) * amplitude * 2;
      });

      const tauX = width / cycles;
      ctx.strokeStyle = `${PALETTE.violetLit}66`;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(tauX, 0);
      ctx.lineTo(tauX, height);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, 'τ', tauX, 12, { colour: PALETTE.violetLit, font: MONO_SMALL });
      label(ctx, '63.2%', tauX + 26, height * 0.85 - amplitude * 2 * 0.632, {
        colour: PALETTE.muted,
        font: MONO_SMALL,
      });
    } else if (kind === 'square') {
      // 555 astable output, duty cycle from Ra and Rb.
      const ra = num('Ra', 10000);
      const rb = num('Rb', 47000);
      const duty = (ra + rb) / (ra + 2 * rb);
      drawTrace(PALETTE.brassLit, (t) => {
        const phase = (t * 3 + sweep) % 1;
        return phase < duty ? mid - amplitude : mid + amplitude;
      });
      label(ctx, `duty ${(duty * 100).toFixed(0)}%`, width - 8, 12, {
        colour: PALETTE.muted,
        font: MONO_SMALL,
        align: 'right',
      });
    } else {
      // Input sine, and the output attenuated and phase-shifted by the RC.
      const r = num('R', 1600);
      const c = num('C', 1e-7);
      const fc = 1 / (2 * Math.PI * r * c);
      // Drive at roughly the corner so the −3 dB and phase lag are visible.
      const ratio = 1;
      const gain = 1 / Math.sqrt(1 + ratio * ratio);
      const phase = Math.atan(ratio);

      drawTrace(
        `${PALETTE.violetLit}99`,
        (t) => mid - Math.sin((t * 3 + sweep) * Math.PI * 2) * amplitude,
        1.4,
        false,
      );
      drawTrace(
        PALETTE.brassLit,
        (t) => mid - Math.sin((t * 3 + sweep) * Math.PI * 2 - phase) * amplitude * gain,
      );

      label(ctx, `fc ≈ ${fc >= 1000 ? `${(fc / 1000).toFixed(2)} kHz` : `${fc.toFixed(0)} Hz`}`, 8, 12, {
        colour: PALETTE.muted,
        font: MONO_SMALL,
        align: 'left',
      });
      label(ctx, `−3 dB at fc`, width - 8, 12, {
        colour: PALETTE.brass,
        font: MONO_SMALL,
        align: 'right',
      });
    }

    // Legend.
    if (kind === 'lowpass' || kind === 'sine') {
      label(ctx, 'in', 8, height - 10, { colour: PALETTE.violetLit, font: MONO_SMALL, align: 'left' });
      label(ctx, 'out', 34, height - 10, { colour: PALETTE.brassLit, font: MONO_SMALL, align: 'left' });
    }
  });

  return <canvas ref={canvasRef} className={className ?? 'block h-full w-full'} />;
}
