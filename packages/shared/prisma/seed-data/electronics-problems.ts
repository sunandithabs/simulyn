/**
 * Electronics problem bank for the demo seed.
 *
 * Each problem carries `params` (the circuit values shown in the simulator)
 * and `questions` (numeric answers checked against `answer` within `tolerance`,
 * which is an absolute tolerance in the question's unit).
 */

export interface SeedElectronicsQuestion {
  id: string;
  text: string;
  answer: number;
  tolerance: number;
  unit: string;
}

export interface SeedElectronicsProblem {
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  category: string;
  points: number;
  tags: string[];
  description: string;
  constraints: string[];
  params: Record<string, number | string>;
  questions: SeedElectronicsQuestion[];
  hints: [string, string, string];
}

export const ELECTRONICS_PROBLEMS: SeedElectronicsProblem[] = [
  {
    title: 'Voltage Divider',
    difficulty: 'EASY',
    category: 'DC Circuits',
    points: 100,
    tags: ['ohms-law', 'resistors', 'dc'],
    description: [
      'A 12 V supply feeds two resistors in series: `R1 = 10 kΩ` on the high side and `R2 = 20 kΩ` to ground. The output is taken across `R2`.',
      '',
      'Build the divider in the simulator, then answer the questions below.',
    ].join('\n'),
    constraints: ['Assume ideal components', 'No load is connected to the output'],
    params: { supply: 12, R1: 10000, R2: 20000, unitR: 'ohm', unitV: 'volt' },
    questions: [
      {
        id: 'vout',
        text: 'What is the output voltage across R2?',
        answer: 8,
        tolerance: 0.05,
        unit: 'V',
      },
      {
        id: 'current',
        text: 'What current flows through the divider, in milliamps?',
        answer: 0.4,
        tolerance: 0.01,
        unit: 'mA',
      },
      {
        id: 'power_r2',
        text: 'How much power is dissipated in R2, in milliwatts?',
        answer: 3.2,
        tolerance: 0.1,
        unit: 'mW',
      },
    ],
    hints: [
      'The two resistors carry the same current because they are in series.',
      'Find the total resistance first, then the loop current with Ohm’s law.',
      'Vout = Vs · R2 / (R1 + R2). Current is Vs / (R1 + R2), and P = I²R.',
    ],
  },

  {
    title: 'LED Current-Limiting Resistor',
    difficulty: 'EASY',
    category: 'Diodes',
    points: 100,
    tags: ['led', 'diode', 'ohms-law'],
    description: [
      'A red LED with a forward voltage of `2.0 V` is to be driven at `20 mA` from a `5 V` rail through a single series resistor.',
      '',
      'Size the resistor and check the power it dissipates.',
    ].join('\n'),
    constraints: [
      'Model the LED as a constant 2.0 V drop',
      'Ignore supply tolerance and temperature effects',
    ],
    params: { supply: 5, forwardVoltage: 2.0, targetCurrent: 0.02, unitR: 'ohm' },
    questions: [
      {
        id: 'resistance',
        text: 'What resistance is required, in ohms?',
        answer: 150,
        tolerance: 1,
        unit: 'Ω',
      },
      {
        id: 'power',
        text: 'How much power does the resistor dissipate, in milliwatts?',
        answer: 60,
        tolerance: 1,
        unit: 'mW',
      },
      {
        id: 'current_at_220',
        text: 'If you substitute a 220 Ω resistor instead, what LED current results, in milliamps?',
        answer: 13.64,
        tolerance: 0.2,
        unit: 'mA',
      },
    ],
    hints: [
      'The resistor and the LED share the same current, and their voltages must add up to the supply.',
      'How many volts are left for the resistor once the LED takes its forward drop?',
      'R = (Vs − Vf) / I = (5 − 2) / 0.02 = 150 Ω, and P = I²R.',
    ],
  },

  {
    title: 'RC Time Constant',
    difficulty: 'MEDIUM',
    category: 'Transients',
    points: 180,
    tags: ['rc', 'capacitor', 'transient'],
    description: [
      'A `10 kΩ` resistor charges a `100 µF` capacitor from a `9 V` supply. The capacitor starts fully discharged and the switch closes at `t = 0`.',
      '',
      'Analyse the charging transient.',
    ].join('\n'),
    constraints: ['Ideal capacitor with no leakage', 'Switch closes at t = 0'],
    params: { supply: 9, R: 10000, C: 0.0001, unitR: 'ohm', unitC: 'farad' },
    questions: [
      {
        id: 'tau',
        text: 'What is the time constant τ, in seconds?',
        answer: 1,
        tolerance: 0.02,
        unit: 's',
      },
      {
        id: 'vc_at_tau',
        text: 'What is the capacitor voltage at t = τ, in volts?',
        answer: 5.69,
        tolerance: 0.05,
        unit: 'V',
      },
      {
        id: 't_99',
        text: 'Approximately how long until the capacitor reaches 99% of the supply, in seconds?',
        answer: 5,
        tolerance: 0.3,
        unit: 's',
      },
    ],
    hints: [
      'The time constant depends only on the resistor and capacitor values, not on the supply.',
      'The charging curve is Vc(t) = Vs · (1 − e^(−t/RC)).',
      'τ = RC = 10 000 × 100 µF = 1 s. At t = τ the capacitor reaches 63.2% of 9 V, and 99% takes about 5τ.',
    ],
  },

  {
    title: 'Op-Amp Gain',
    difficulty: 'MEDIUM',
    category: 'Amplifiers',
    points: 180,
    tags: ['op-amp', 'gain', 'analog'],
    description: [
      'An ideal op-amp is wired as a **non-inverting amplifier** with `Rf = 90 kΩ` in the feedback path and `Rin = 10 kΩ` from the inverting input to ground. The input signal is `0.5 V` DC.',
      '',
      'Work out the gain, then compare it with the inverting configuration built from the same two resistors.',
    ].join('\n'),
    constraints: [
      'Ideal op-amp: infinite open-loop gain, no input current',
      'Supply rails are wide enough to avoid clipping',
    ],
    params: { Rf: 90000, Rin: 10000, vin: 0.5, topology: 'non-inverting' },
    questions: [
      {
        id: 'gain',
        text: 'What is the closed-loop voltage gain of the non-inverting amplifier?',
        answer: 10,
        tolerance: 0.05,
        unit: 'V/V',
      },
      {
        id: 'vout',
        text: 'What is the output voltage, in volts?',
        answer: 5,
        tolerance: 0.05,
        unit: 'V',
      },
      {
        id: 'inverting_gain',
        text: 'Rewired as an inverting amplifier with the same resistors, what is the gain?',
        answer: -9,
        tolerance: 0.05,
        unit: 'V/V',
      },
    ],
    hints: [
      'With negative feedback, an ideal op-amp drives its two inputs to the same voltage.',
      'The feedback network is a voltage divider from the output back to the inverting input.',
      'Non-inverting: Av = 1 + Rf/Rin = 10. Inverting: Av = −Rf/Rin = −9.',
    ],
  },

  {
    title: 'RC Low-Pass Filter',
    difficulty: 'HARD',
    category: 'Filters',
    points: 250,
    tags: ['filter', 'frequency-response', 'rc'],
    description: [
      'A first-order RC low-pass filter uses `R = 1.6 kΩ` and `C = 0.1 µF`.',
      '',
      'Characterise its frequency response: the cutoff, the gain at cutoff, and the roll-off a decade above it.',
    ].join('\n'),
    constraints: ['Ideal components', 'Output is unloaded'],
    params: { R: 1600, C: 0.0000001, unitR: 'ohm', unitC: 'farad', order: 1 },
    questions: [
      {
        id: 'fc',
        text: 'What is the −3 dB cutoff frequency, in hertz?',
        answer: 994.7,
        tolerance: 10,
        unit: 'Hz',
      },
      {
        id: 'gain_at_fc',
        text: 'What is the voltage gain at the cutoff frequency, in decibels?',
        answer: -3.01,
        tolerance: 0.15,
        unit: 'dB',
      },
      {
        id: 'gain_decade',
        text: 'What is the gain one decade above the cutoff, in decibels?',
        answer: -20,
        tolerance: 0.5,
        unit: 'dB',
      },
    ],
    hints: [
      'At the cutoff the capacitor’s reactance equals the resistance.',
      'Xc = 1 / (2πfC). Setting Xc = R and solving for f gives the cutoff.',
      'fc = 1 / (2πRC) ≈ 995 Hz. A first-order filter is −3 dB at fc and rolls off at −20 dB per decade after it.',
    ],
  },

  {
    title: 'Parallel Resistor Branches',
    difficulty: 'EASY',
    category: 'DC Circuits',
    points: 100,
    tags: ['parallel','ohms-law','dc'],
    description: 'A 12 V supply drives `R1 = 6 kΩ` and `R2 = 3 kΩ` in parallel. Build it in the simulator and answer the questions.',
    constraints: ['Assume ideal components'],
    params: { supply: 12, R1: 6000, R2: 3000 },
    questions: [
      { id: 'req', text: 'What is the equivalent resistance?', answer: 2, tolerance: 0.02, unit: 'kΩ' },
      { id: 'itotal', text: 'What is the total supply current?', answer: 6, tolerance: 0.05, unit: 'mA' },
      { id: 'ir1', text: 'What current flows through R1?', answer: 2, tolerance: 0.05, unit: 'mA' },
      { id: 'ptotal', text: 'What is the total power drawn?', answer: 72, tolerance: 0.5, unit: 'mW' },
    ],
    hints: [
      'Each parallel branch sees the full supply voltage.',
      'Req = R1·R2 / (R1 + R2).',
      'Branch current is V / R; total power is V · Itotal.',
    ],
  },

  {
    title: 'RL Time Constant',
    difficulty: 'MEDIUM',
    category: 'Transients',
    points: 150,
    tags: ['inductor','transient','time-constant'],
    description: 'A 10 V step is applied to `L = 10 mH` in series with `R = 100 Ω`. The inductor starts with zero current.',
    constraints: ['Assume an ideal inductor and source'],
    params: { supply: 10, R: 100, L: 0.01 },
    questions: [
      { id: 'tau', text: 'What is the time constant?', answer: 0.1, tolerance: 0.005, unit: 'ms' },
      { id: 'ifinal', text: 'What is the final steady-state current?', answer: 100, tolerance: 0.5, unit: 'mA' },
      { id: 'it', text: 'What is the current after one time constant?', answer: 63.2, tolerance: 0.5, unit: 'mA' },
    ],
    hints: [
      'The time constant of a series RL circuit is L / R.',
      'At steady state the inductor behaves like a short circuit.',
      'i(t) = (V/R)(1 − e^(−t/τ)); at t = τ it reaches about 63.2%.',
    ],
  },

  {
    title: 'Inverting Op-Amp Amplifier',
    difficulty: 'MEDIUM',
    category: 'Op-Amps',
    points: 150,
    tags: ['op-amp','inverting','gain'],
    description: 'An ideal op-amp is wired as an inverting amplifier with `Rin = 1 kΩ`, `Rf = 10 kΩ` and `Vin = 0.5 V`. The supply rails are ±12 V.',
    constraints: ['Ideal op-amp, negative feedback'],
    params: { Rin: 1000, Rf: 10000, Vin: 0.5, rail: 12 },
    questions: [
      { id: 'gain', text: 'What is the closed-loop gain?', answer: -10, tolerance: 0.05, unit: 'V/V' },
      { id: 'vout', text: 'What is the output voltage?', answer: -5, tolerance: 0.05, unit: 'V' },
      { id: 'iin', text: 'What current flows through Rin?', answer: 0.5, tolerance: 0.01, unit: 'mA' },
    ],
    hints: [
      'The inverting input is a virtual ground.',
      'Gain = −Rf / Rin.',
      'The input current all flows through Rf, so Vout = −Iin · Rf.',
    ],
  },

  {
    title: 'Zener Shunt Regulator',
    difficulty: 'MEDIUM',
    category: 'Diodes',
    points: 150,
    tags: ['zener','regulator','diode'],
    description: 'A 12 V source feeds a `220 Ω` series resistor and a `5.1 V` zener in parallel with a `1 kΩ` load. The zener is in breakdown.',
    constraints: ['Ideal zener at exactly 5.1 V'],
    params: { supply: 12, Rs: 220, Vz: 5.1, RL: 1000 },
    questions: [
      { id: 'irs', text: 'What current flows through the series resistor?', answer: 31.36, tolerance: 0.1, unit: 'mA' },
      { id: 'il', text: 'What is the load current?', answer: 5.1, tolerance: 0.05, unit: 'mA' },
      { id: 'iz', text: 'What is the zener current?', answer: 26.26, tolerance: 0.1, unit: 'mA' },
      { id: 'pz', text: 'How much power does the zener dissipate?', answer: 133.9, tolerance: 0.5, unit: 'mW' },
    ],
    hints: [
      'The output is held at Vz, so the voltage across Rs is known.',
      'Irs = (Vs − Vz) / Rs; the load current is Vz / RL.',
      'Iz = Irs − IL, and Pz = Vz · Iz.',
    ],
  },

  {
    title: 'BJT as a Switch',
    difficulty: 'HARD',
    category: 'Transistors',
    points: 150,
    tags: ['bjt','switch','saturation'],
    description: 'An NPN BJT (`β = 100`, `Vbe = 0.7 V`) switches a `330 Ω` load from a 5 V rail. The base is driven from 5 V through `10 kΩ`.',
    constraints: ['Ignore Vce(sat)'],
    params: { vcc: 5, RB: 10000, RC: 330, beta: 100, vbe: 0.7 },
    questions: [
      { id: 'ib', text: 'What is the base current?', answer: 0.43, tolerance: 0.01, unit: 'mA' },
      { id: 'ic', text: 'What is the collector current (saturated)?', answer: 15.15, tolerance: 0.1, unit: 'mA' },
      { id: 'forced', text: 'What is the forced beta IC / IB?', answer: 35.2, tolerance: 0.3, unit: '' },
    ],
    hints: [
      'Base current flows through RB with Vbe dropped.',
      'If β·IB exceeds Vcc / RC, the transistor saturates.',
      'In saturation IC = Vcc / RC, so the forced beta is IC / IB.',
    ],
  },
];
