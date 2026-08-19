import { label, MONO_SMALL, PALETTE, roundedRect } from '../draw';

export type SymbolKind =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'opamp'
  | 'source'
  | 'ground'
  | 'bjt'
  | 'led'
  | 'ic555'
  | 'switch';

export interface Point {
  x: number;
  y: number;
}

export interface CircuitElement {
  kind: SymbolKind;
  /** Centre, in the schematic's 0–100 coordinate space. */
  at: Point;
  /** 0 = leads left/right, 90 = leads top/bottom. */
  rotation?: 0 | 90;
  name: string;
  value?: string;
  /** Half-length along the lead axis, in schematic units. */
  span?: number;
}

/**
 * Every symbol draws in canvas pixels around (0,0) with leads along the x axis;
 * the view rotates and translates. Keeping them origin-centred is what makes
 * the 90° rotation a one-liner.
 */
export function drawSymbol(
  ctx: CanvasRenderingContext2D,
  element: CircuitElement,
  size: number,
  colour: string,
): void {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (element.kind) {
    case 'resistor': {
      // Zigzag body with a lead each side.
      const bodyHalf = size * 0.55;
      const peak = size * 0.32;
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(-bodyHalf, 0);
      const steps = 6;
      for (let i = 0; i < steps; i++) {
        const x = -bodyHalf + ((i + 0.5) * (bodyHalf * 2)) / steps;
        ctx.lineTo(x, i % 2 === 0 ? -peak : peak);
      }
      ctx.lineTo(bodyHalf, 0);
      ctx.lineTo(size, 0);
      ctx.stroke();
      break;
    }

    case 'capacitor': {
      const plate = size * 0.42;
      const gap = size * 0.16;
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(-gap, 0);
      ctx.moveTo(gap, 0);
      ctx.lineTo(size, 0);
      ctx.stroke();
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-gap, -plate);
      ctx.lineTo(-gap, plate);
      ctx.moveTo(gap, -plate);
      ctx.lineTo(gap, plate);
      ctx.stroke();
      break;
    }

    case 'inductor': {
      const coils = 4;
      const radius = size * 0.26;
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(-radius * coils, 0);
      for (let i = 0; i < coils; i++) {
        ctx.arc(-radius * coils + radius * (2 * i + 1), 0, radius, Math.PI, 0, false);
      }
      ctx.lineTo(size, 0);
      ctx.stroke();
      break;
    }

    case 'source': {
      const radius = size * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(0, -radius);
      ctx.moveTo(0, radius);
      ctx.lineTo(0, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      // + above, − below.
      ctx.beginPath();
      ctx.moveTo(-radius * 0.3, -radius * 0.35);
      ctx.lineTo(radius * 0.3, -radius * 0.35);
      ctx.moveTo(0, -radius * 0.65);
      ctx.lineTo(0, -radius * 0.05);
      ctx.moveTo(-radius * 0.3, radius * 0.4);
      ctx.lineTo(radius * 0.3, radius * 0.4);
      ctx.stroke();
      break;
    }

    case 'ground': {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.7);
      ctx.lineTo(0, 0);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const half = size * (0.6 - i * 0.19);
        const y = i * size * 0.22;
        ctx.beginPath();
        ctx.moveTo(-half, y);
        ctx.lineTo(half, y);
        ctx.stroke();
      }
      break;
    }

    case 'opamp': {
      const w = size * 1.5;
      const h = size * 1.4;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
      ctx.stroke();
      // Input leads and output lead.
      ctx.beginPath();
      ctx.moveTo(-w / 2 - size * 0.5, -h * 0.25);
      ctx.lineTo(-w / 2, -h * 0.25);
      ctx.moveTo(-w / 2 - size * 0.5, h * 0.25);
      ctx.lineTo(-w / 2, h * 0.25);
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2 + size * 0.5, 0);
      ctx.stroke();
      label(ctx, '+', -w / 2 + size * 0.28, h * 0.25, { colour, font: MONO_SMALL });
      label(ctx, '−', -w / 2 + size * 0.28, -h * 0.25, { colour, font: MONO_SMALL });
      break;
    }

    case 'bjt': {
      // NPN: vertical base bar, angled collector and emitter, arrow outward.
      const barHalf = size * 0.55;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
      ctx.strokeStyle = `${colour}55`;
      ctx.stroke();

      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.moveTo(-size * 0.75, 0);
      ctx.lineTo(-size * 0.25, 0);
      ctx.moveTo(-size * 0.25, -barHalf);
      ctx.lineTo(-size * 0.25, barHalf);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-size * 0.25, -barHalf * 0.55);
      ctx.lineTo(size * 0.5, -barHalf);
      ctx.lineTo(size * 0.5, -size);
      ctx.moveTo(-size * 0.25, barHalf * 0.55);
      ctx.lineTo(size * 0.5, barHalf);
      ctx.lineTo(size * 0.5, size);
      ctx.stroke();

      // Emitter arrow, pointing out of the device (NPN).
      const ax = size * 0.28;
      const ay = barHalf * 0.85;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(ax + 5, ay + 4);
      ctx.lineTo(ax - 3, ay - 1);
      ctx.lineTo(ax + 1, ay + 6);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'led': {
      // Triangle into a bar, with two emission arrows.
      const half = size * 0.45;
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(-half, 0);
      ctx.moveTo(half, 0);
      ctx.lineTo(size, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-half, -half);
      ctx.lineTo(half, 0);
      ctx.lineTo(-half, half);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(half, -half);
      ctx.lineTo(half, half);
      ctx.stroke();
      for (const offset of [-0.2, 0.25]) {
        ctx.beginPath();
        ctx.moveTo(offset * size, -half - 3);
        ctx.lineTo(offset * size + size * 0.35, -half - size * 0.5);
        ctx.stroke();
      }
      break;
    }

    case 'ic555': {
      const w = size * 2.2;
      const h = size * 2.6;
      roundedRect(ctx, -w / 2, -h / 2, w, h, 4);
      ctx.stroke();
      // Pin stubs, four a side.
      for (let i = 0; i < 4; i++) {
        const y = -h / 2 + h * (0.2 + i * 0.2);
        ctx.beginPath();
        ctx.moveTo(-w / 2 - size * 0.35, y);
        ctx.lineTo(-w / 2, y);
        ctx.moveTo(w / 2, y);
        ctx.lineTo(w / 2 + size * 0.35, y);
        ctx.stroke();
      }
      label(ctx, '555', 0, 0, { colour, font: MONO_SMALL });
      break;
    }

    case 'switch': {
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(-size * 0.4, 0);
      ctx.moveTo(size * 0.4, 0);
      ctx.lineTo(size, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-size * 0.4, 0, 2.2, 0, Math.PI * 2);
      ctx.moveTo(size * 0.4 + 2.2, 0);
      ctx.arc(size * 0.4, 0, 2.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, 0);
      ctx.lineTo(size * 0.3, -size * 0.5);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

/** Roughly how far a symbol reaches from its centre, for hit testing. */
export function symbolRadius(kind: SymbolKind, size: number): number {
  if (kind === 'ic555') return size * 1.4;
  if (kind === 'opamp' || kind === 'bjt') return size * 1.1;
  return size * 0.9;
}

export { PALETTE };
