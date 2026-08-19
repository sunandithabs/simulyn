import type { CircuitElement, Point } from './symbols';

export interface Wire {
  points: Point[];
  /** 0 = ground, 1 = supply. Drives the blue→red gradient along the wire. */
  potential: number;
}

export interface Schematic {
  title: string;
  elements: CircuitElement[];
  wires: Wire[];
  /** Where a measurement lands on the diagram, keyed by question id. */
  probes: Record<string, { at: Point; label: string }>;
  /** Shown when the problem is a frequency-response one. */
  waveform?: 'lowpass' | 'square' | 'sine' | 'charge';
}

type Params = Record<string, unknown>;

const num = (params: Params, key: string, fallback = 0): number => {
  const value = params[key];
  return typeof value === 'number' ? value : Number(value) || fallback;
};

/** 10000 → "10 kΩ", 0.0001 → "100 µF". */
export function formatValue(value: number, unit: string): string {
  const abs = Math.abs(value);
  const scales: [number, string][] = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
    [1e-12, 'p'],
  ];

  if (abs === 0) return `0 ${unit}`;
  for (const [factor, prefix] of scales) {
    if (abs >= factor) {
      const scaled = value / factor;
      const text = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(2).replace(/\.?0+$/, '');
      return `${text} ${prefix}${unit}`;
    }
  }
  return `${value} ${unit}`;
}

// ── templates ──────────────────────────────────────────────────────────

function voltageDivider(params: Params): Schematic {
  const supply = num(params, 'supply', 12);
  const r1 = num(params, 'R1', 10000);
  const r2 = num(params, 'R2', 20000);
  const vout = (supply * r2) / (r1 + r2 || 1);

  return {
    title: 'Resistive divider',
    elements: [
      { kind: 'source', at: { x: 14, y: 50 }, name: 'Vs', value: formatValue(supply, 'V'), span: 6 },
      { kind: 'resistor', at: { x: 46, y: 22 }, name: 'R1', value: formatValue(r1, 'Ω') },
      { kind: 'resistor', at: { x: 70, y: 55 }, rotation: 90, name: 'R2', value: formatValue(r2, 'Ω') },
      { kind: 'ground', at: { x: 70, y: 86 }, name: 'GND' },
      { kind: 'ground', at: { x: 14, y: 86 }, name: 'GND' },
    ],
    wires: [
      { points: [{ x: 14, y: 40 }, { x: 14, y: 22 }, { x: 36, y: 22 }], potential: 1 },
      { points: [{ x: 56, y: 22 }, { x: 70, y: 22 }, { x: 70, y: 43 }], potential: 0.55 },
      { points: [{ x: 70, y: 67 }, { x: 70, y: 80 }], potential: 0.05 },
      { points: [{ x: 14, y: 60 }, { x: 14, y: 80 }], potential: 0 },
      { points: [{ x: 14, y: 80 }, { x: 70, y: 80 }], potential: 0 },
      { points: [{ x: 70, y: 30 }, { x: 90, y: 30 }], potential: 0.55 },
    ],
    probes: {
      vout: { at: { x: 90, y: 30 }, label: `Vout ${formatValue(vout, 'V')}` },
      current: { at: { x: 46, y: 22 }, label: 'I' },
      power_r2: { at: { x: 70, y: 55 }, label: 'P' },
    },
  };
}

function ledResistor(params: Params): Schematic {
  const supply = num(params, 'supply', 5);
  const forward = num(params, 'forwardVoltage', 2);

  return {
    title: 'LED with a series resistor',
    elements: [
      { kind: 'source', at: { x: 14, y: 50 }, name: 'Vs', value: formatValue(supply, 'V'), span: 6 },
      { kind: 'resistor', at: { x: 44, y: 22 }, name: 'R', value: '?' },
      { kind: 'led', at: { x: 74, y: 22 }, name: 'LED', value: `Vf ${formatValue(forward, 'V')}` },
      { kind: 'ground', at: { x: 88, y: 80 }, name: 'GND' },
      { kind: 'ground', at: { x: 14, y: 86 }, name: 'GND' },
    ],
    wires: [
      { points: [{ x: 14, y: 40 }, { x: 14, y: 22 }, { x: 34, y: 22 }], potential: 1 },
      { points: [{ x: 54, y: 22 }, { x: 64, y: 22 }], potential: 0.6 },
      { points: [{ x: 84, y: 22 }, { x: 88, y: 22 }, { x: 88, y: 74 }], potential: 0.1 },
      { points: [{ x: 14, y: 60 }, { x: 14, y: 80 }, { x: 88, y: 80 }], potential: 0 },
    ],
    probes: {
      resistance: { at: { x: 44, y: 22 }, label: 'R' },
      power: { at: { x: 44, y: 22 }, label: 'P' },
      current_at_220: { at: { x: 74, y: 22 }, label: 'I' },
    },
  };
}

function rcTransient(params: Params): Schematic {
  const supply = num(params, 'supply', 9);
  const r = num(params, 'R', 10000);
  const c = num(params, 'C', 0.0001);

  return {
    title: 'RC charging circuit',
    waveform: 'charge',
    elements: [
      { kind: 'source', at: { x: 14, y: 50 }, name: 'Vs', value: formatValue(supply, 'V'), span: 6 },
      { kind: 'switch', at: { x: 36, y: 22 }, name: 'SW', value: 'closes at t=0' },
      { kind: 'resistor', at: { x: 60, y: 22 }, name: 'R', value: formatValue(r, 'Ω') },
      { kind: 'capacitor', at: { x: 82, y: 55 }, rotation: 90, name: 'C', value: formatValue(c, 'F') },
      { kind: 'ground', at: { x: 82, y: 86 }, name: 'GND' },
      { kind: 'ground', at: { x: 14, y: 86 }, name: 'GND' },
    ],
    wires: [
      { points: [{ x: 14, y: 40 }, { x: 14, y: 22 }, { x: 28, y: 22 }], potential: 1 },
      { points: [{ x: 44, y: 22 }, { x: 50, y: 22 }], potential: 0.95 },
      { points: [{ x: 70, y: 22 }, { x: 82, y: 22 }, { x: 82, y: 45 }], potential: 0.5 },
      { points: [{ x: 82, y: 65 }, { x: 82, y: 80 }], potential: 0.05 },
      { points: [{ x: 14, y: 60 }, { x: 14, y: 80 }, { x: 82, y: 80 }], potential: 0 },
    ],
    probes: {
      tau: { at: { x: 60, y: 22 }, label: 'τ = RC' },
      vc_at_tau: { at: { x: 82, y: 55 }, label: 'Vc' },
      t_99: { at: { x: 82, y: 55 }, label: '99%' },
    },
  };
}

function opAmp(params: Params): Schematic {
  const rf = num(params, 'Rf', 90000);
  const rin = num(params, 'Rin', 10000);
  const vin = num(params, 'vin', 0.5);

  return {
    title: `Non-inverting amplifier · Vin ${formatValue(vin, 'V')}`,
    elements: [
      { kind: 'opamp', at: { x: 52, y: 44 }, name: 'U1', value: 'ideal' },
      { kind: 'resistor', at: { x: 46, y: 78 }, name: 'Rf', value: formatValue(rf, 'Ω') },
      { kind: 'resistor', at: { x: 18, y: 78 }, name: 'Rin', value: formatValue(rin, 'Ω') },
      { kind: 'ground', at: { x: 6, y: 90 }, name: 'GND' },
    ],
    wires: [
      // Non-inverting input from the source.
      { points: [{ x: 6, y: 34 }, { x: 40, y: 34 }], potential: 0.5 },
      // Feedback divider tapping the inverting input.
      { points: [{ x: 40, y: 54 }, { x: 32, y: 54 }, { x: 32, y: 78 }], potential: 0.4 },
      { points: [{ x: 32, y: 78 }, { x: 36, y: 78 }], potential: 0.4 },
      { points: [{ x: 26, y: 78 }, { x: 32, y: 78 }], potential: 0.4 },
      { points: [{ x: 10, y: 78 }, { x: 6, y: 78 }, { x: 6, y: 84 }], potential: 0 },
      { points: [{ x: 56, y: 78 }, { x: 76, y: 78 }, { x: 76, y: 44 }], potential: 0.95 },
      { points: [{ x: 64, y: 44 }, { x: 90, y: 44 }], potential: 0.95 },
    ],
    probes: {
      gain: { at: { x: 46, y: 78 }, label: 'Av' },
      vout: { at: { x: 90, y: 44 }, label: 'Vout' },
      inverting_gain: { at: { x: 18, y: 78 }, label: '−Rf/Rin' },
    },
  };
}

function rcLowPass(params: Params): Schematic {
  const r = num(params, 'R', 1600);
  const c = num(params, 'C', 1e-7);

  return {
    title: 'First-order low-pass filter',
    waveform: 'lowpass',
    elements: [
      { kind: 'source', at: { x: 12, y: 46 }, name: 'Vin', value: 'sine', span: 6 },
      { kind: 'resistor', at: { x: 44, y: 22 }, name: 'R', value: formatValue(r, 'Ω') },
      { kind: 'capacitor', at: { x: 70, y: 52 }, rotation: 90, name: 'C', value: formatValue(c, 'F') },
      { kind: 'ground', at: { x: 70, y: 84 }, name: 'GND' },
      { kind: 'ground', at: { x: 12, y: 84 }, name: 'GND' },
    ],
    wires: [
      { points: [{ x: 12, y: 36 }, { x: 12, y: 22 }, { x: 34, y: 22 }], potential: 1 },
      { points: [{ x: 54, y: 22 }, { x: 70, y: 22 }, { x: 70, y: 42 }], potential: 0.6 },
      { points: [{ x: 70, y: 62 }, { x: 70, y: 78 }], potential: 0.05 },
      { points: [{ x: 12, y: 56 }, { x: 12, y: 78 }, { x: 70, y: 78 }], potential: 0 },
      { points: [{ x: 70, y: 30 }, { x: 92, y: 30 }], potential: 0.6 },
    ],
    probes: {
      fc: { at: { x: 44, y: 22 }, label: 'fc' },
      gain_at_fc: { at: { x: 92, y: 30 }, label: '−3 dB' },
      gain_decade: { at: { x: 92, y: 30 }, label: '−20 dB' },
    },
  };
}

function bjtCommonEmitter(params: Params): Schematic {
  const vcc = num(params, 'Vcc', 12);
  const rc = num(params, 'Rc', 2200);
  const r1 = num(params, 'R1', 47000);
  const r2 = num(params, 'R2', 10000);
  const re = num(params, 'Re', 470);

  return {
    title: `Common-emitter stage · Vcc ${formatValue(vcc, 'V')}`,
    elements: [
      { kind: 'resistor', at: { x: 62, y: 20 }, rotation: 90, name: 'Rc', value: formatValue(rc, 'Ω') },
      { kind: 'resistor', at: { x: 22, y: 20 }, rotation: 90, name: 'R1', value: formatValue(r1, 'Ω') },
      { kind: 'resistor', at: { x: 22, y: 64 }, rotation: 90, name: 'R2', value: formatValue(r2, 'Ω') },
      { kind: 'bjt', at: { x: 56, y: 48 }, name: 'Q1', value: 'NPN' },
      { kind: 'resistor', at: { x: 62, y: 74 }, rotation: 90, name: 'Re', value: formatValue(re, 'Ω') },
      { kind: 'ground', at: { x: 62, y: 90 }, name: 'GND' },
      { kind: 'ground', at: { x: 22, y: 90 }, name: 'GND' },
    ],
    wires: [
      { points: [{ x: 8, y: 8 }, { x: 90, y: 8 }], potential: 1 },
      { points: [{ x: 22, y: 8 }, { x: 22, y: 12 }], potential: 1 },
      { points: [{ x: 62, y: 8 }, { x: 62, y: 12 }], potential: 1 },
      { points: [{ x: 22, y: 28 }, { x: 22, y: 56 }], potential: 0.45 },
      { points: [{ x: 22, y: 42 }, { x: 48, y: 42 }, { x: 48, y: 48 }], potential: 0.45 },
      { points: [{ x: 22, y: 72 }, { x: 22, y: 84 }], potential: 0 },
      { points: [{ x: 62, y: 28 }, { x: 62, y: 40 }], potential: 0.7 },
      { points: [{ x: 62, y: 34 }, { x: 90, y: 34 }], potential: 0.7 },
      { points: [{ x: 62, y: 56 }, { x: 62, y: 66 }], potential: 0.2 },
      { points: [{ x: 62, y: 82 }, { x: 62, y: 84 }], potential: 0 },
    ],
    probes: {
      vb: { at: { x: 22, y: 42 }, label: 'Vb' },
      vc: { at: { x: 90, y: 34 }, label: 'Vc' },
      ve: { at: { x: 62, y: 66 }, label: 'Ve' },
      ic: { at: { x: 62, y: 20 }, label: 'Ic' },
    },
  };
}

function timer555(params: Params): Schematic {
  const ra = num(params, 'Ra', 10000);
  const rb = num(params, 'Rb', 47000);
  const c = num(params, 'C', 1e-6);

  return {
    title: '555 astable',
    waveform: 'square',
    elements: [
      { kind: 'ic555', at: { x: 52, y: 46 }, name: 'U1', value: 'astable' },
      { kind: 'resistor', at: { x: 20, y: 16 }, name: 'Ra', value: formatValue(ra, 'Ω') },
      { kind: 'resistor', at: { x: 20, y: 44 }, name: 'Rb', value: formatValue(rb, 'Ω') },
      { kind: 'capacitor', at: { x: 14, y: 74 }, rotation: 90, name: 'C', value: formatValue(c, 'F') },
      { kind: 'ground', at: { x: 14, y: 90 }, name: 'GND' },
    ],
    wires: [
      { points: [{ x: 8, y: 6 }, { x: 90, y: 6 }], potential: 1 },
      { points: [{ x: 10, y: 6 }, { x: 10, y: 16 }], potential: 1 },
      { points: [{ x: 30, y: 16 }, { x: 36, y: 16 }, { x: 36, y: 34 }], potential: 0.8 },
      { points: [{ x: 10, y: 44 }, { x: 10, y: 16 }], potential: 0.8 },
      { points: [{ x: 30, y: 44 }, { x: 36, y: 44 }], potential: 0.5 },
      { points: [{ x: 14, y: 44 }, { x: 14, y: 64 }], potential: 0.5 },
      { points: [{ x: 14, y: 84 }, { x: 14, y: 86 }], potential: 0 },
      { points: [{ x: 68, y: 40 }, { x: 90, y: 40 }], potential: 0.9 },
      { points: [{ x: 52, y: 6 }, { x: 52, y: 28 }], potential: 1 },
    ],
    probes: {
      frequency: { at: { x: 90, y: 40 }, label: 'f' },
      duty: { at: { x: 90, y: 40 }, label: 'D' },
      period: { at: { x: 14, y: 74 }, label: 'T' },
    },
  };
}

/**
 * Picks a layout from the problem's category, then from the shape of its
 * parameters — so a newly authored problem still gets a diagram as long as it
 * names its components conventionally.
 */
export function buildSchematic(category: string, params: Params | null): Schematic | null {
  const safe = params ?? {};
  const key = category.trim().toLowerCase();

  const byCategory: Record<string, (p: Params) => Schematic> = {
    'dc circuits': voltageDivider,
    diodes: ledResistor,
    transients: rcTransient,
    amplifiers: opAmp,
    filters: rcLowPass,
    'frequency response': rcLowPass,
    'analog electronics': opAmp,
    'semiconductor circuits': bjtCommonEmitter,
    'timing circuits': timer555,
  };

  if (byCategory[key]) return byCategory[key](safe);

  // Fall back on which component values the author supplied.
  const has = (name: string) => safe[name] !== undefined;
  if (has('Ra') && has('Rb')) return timer555(safe);
  if (has('Rc') && has('Re')) return bjtCommonEmitter(safe);
  if (has('Rf') && has('Rin')) return opAmp(safe);
  if (has('forwardVoltage')) return ledResistor(safe);
  if (has('R1') && has('R2')) return voltageDivider(safe);
  if (has('R') && has('C')) return rcLowPass(safe);

  return null;
}
