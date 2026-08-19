'use client';

import { useState } from 'react';

export interface SkillDatum {
  category: string;
  accuracy: number; // 0–100
  attempts: number;
  solved: number;
}

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 86;
const RINGS = [0.25, 0.5, 0.75, 1];

function pointAt(index: number, total: number, fraction: number): [number, number] {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  return [CENTER + Math.cos(angle) * RADIUS * fraction, CENTER + Math.sin(angle) * RADIUS * fraction];
}

function polygon(values: number[]): string {
  return values
    .map((value, i) => pointAt(i, values.length, value).join(','))
    .join(' ');
}

/**
 * Accuracy profile across problem categories.
 *
 * One series, so shape carries the meaning and no legend is needed. Every axis
 * is also directly labelled with its percentage, because a radar alone is a
 * poor instrument for reading exact magnitudes.
 */
export function SkillRadar({ data }: { data: SkillDatum[] }) {
  const [active, setActive] = useState<number | null>(null);

  if (data.length < 3) {
    return (
      <p className="px-1 py-8 text-center text-sm text-muted">
        Solve problems in at least three categories to see your profile take shape.
      </p>
    );
  }

  const fractions = data.map((d) => Math.max(0.04, d.accuracy / 100));
  const current = active === null ? null : data[active];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto block h-auto w-full max-w-[300px] overflow-visible"
        role="img"
        aria-label={`Accuracy by category: ${data
          .map((d) => `${d.category} ${d.accuracy}%`)
          .join(', ')}`}
      >
        {/* Recessive grid: rings then spokes. */}
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={polygon(data.map(() => ring))}
            fill="none"
            stroke="#ffffff12"
            strokeWidth={1}
          />
        ))}
        {data.map((_, i) => {
          const [x, y] = pointAt(i, data.length, 1);
          return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#ffffff0e" strokeWidth={1} />;
        })}

        <polygon
          points={polygon(fractions)}
          fill="#7352b833"
          stroke="#a78bfa"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {data.map((datum, i) => {
          const [x, y] = pointAt(i, data.length, fractions[i]);
          const [lx, ly] = pointAt(i, data.length, 1.3);
          const isActive = active === i;
          return (
            <g key={datum.category}>
              <circle
                cx={x}
                cy={y}
                r={isActive ? 5.5 : 4}
                fill="#e8cc80"
                stroke="#11111f"
                strokeWidth={2}
              />
              <text
                x={lx}
                y={ly - 4}
                textAnchor="middle"
                className="fill-[#8b8ba7] font-mono text-[9px] tracking-[0.08em] uppercase"
              >
                {datum.category.length > 12 ? `${datum.category.slice(0, 11)}…` : datum.category}
              </text>
              <text
                x={lx}
                y={ly + 8}
                textAnchor="middle"
                className="fill-[#e9e9f2] text-[11px] font-semibold"
              >
                {datum.accuracy}%
              </text>
              {/* Generous hit target, larger than the mark. */}
              <circle
                cx={x}
                cy={y}
                r={14}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>

      {current ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-fit rounded-lg border border-line-strong bg-ink-sunken px-3 py-2 text-center shadow-xl">
          <div className="text-[13px] font-medium text-paper">{current.category}</div>
          <div className="mt-0.5 font-mono text-[11px] text-muted tabular">
            {current.solved} solved · {current.attempts} attempts · {current.accuracy}% accuracy
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Groups submissions into per-category accuracy. */
export function toSkillData(
  rows: { passed: boolean; problemId: string; problem: { category: string } }[],
): SkillDatum[] {
  const map = new Map<string, { attempts: number; passed: number; solved: Set<string> }>();

  for (const row of rows) {
    const entry = map.get(row.problem.category) ?? { attempts: 0, passed: 0, solved: new Set() };
    entry.attempts += 1;
    if (row.passed) {
      entry.passed += 1;
      entry.solved.add(row.problemId);
    }
    map.set(row.problem.category, entry);
  }

  return [...map.entries()]
    .map(([category, value]) => ({
      category,
      attempts: value.attempts,
      solved: value.solved.size,
      accuracy: Math.round((value.passed / value.attempts) * 100),
    }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 8);
}
