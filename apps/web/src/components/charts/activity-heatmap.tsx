'use client';

import { useMemo, useState } from 'react';

/**
 * Submissions per day over the last thirteen weeks.
 *
 * Magnitude on a single hue, light→dark within the dark surface: four violet
 * steps above an empty-day surface colour. Weeks run left to right, weekdays
 * top to bottom.
 */
const CELL = 11;
const GAP = 3;
const WEEKS = 13;
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

// Sequential ramp: one hue, monotonically lighter with volume.
const STEPS = ['#191927', '#33265c', '#4c3591', '#7352b8', '#a78bfa'];

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function stepFor(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio > 0.66) return 4;
  if (ratio > 0.33) return 3;
  if (ratio > 0.15) return 2;
  return 1;
}

export function ActivityHeatmap({ dates }: { dates: string[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);

  const { columns, max, total, months } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const value of dates) {
      const key = dayKey(new Date(value));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    // Start on the Sunday that opens the window, so columns are whole weeks.
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (WEEKS * 7 - 1));
    start.setDate(start.getDate() - start.getDay());

    const grid: { date: Date; count: number }[][] = [];
    const monthMarks: { week: number; label: string }[] = [];
    const cursor = new Date(start);
    let highest = 0;
    let sum = 0;
    let lastMonth = -1;

    for (let week = 0; week < WEEKS + 1; week++) {
      const column: { date: Date; count: number }[] = [];
      for (let day = 0; day < 7; day++) {
        const date = new Date(cursor);
        const count = date > end ? -1 : (counts.get(dayKey(date)) ?? 0);
        if (count > 0) {
          highest = Math.max(highest, count);
          sum += count;
        }
        if (day === 0 && date.getMonth() !== lastMonth && date <= end) {
          lastMonth = date.getMonth();
          monthMarks.push({
            week,
            label: date.toLocaleDateString(undefined, { month: 'short' }),
          });
        }
        column.push({ date, count });
        cursor.setDate(cursor.getDate() + 1);
      }
      grid.push(column);
    }

    return { columns: grid, max: highest, total: sum, months: monthMarks };
  }, [dates]);

  const width = columns.length * (CELL + GAP);

  return (
    <div className="relative">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div
          className="flex shrink-0 flex-col justify-between pt-[14px] pb-0.5"
          style={{ height: 7 * (CELL + GAP) + 14 }}
        >
          {DAY_LABELS.map((label, i) => (
            <span key={i} className="h-[11px] font-mono text-[9px] leading-[11px] text-faint">
              {label}
            </span>
          ))}
        </div>

        <svg
          width={width}
          height={7 * (CELL + GAP) + 14}
          className="shrink-0"
          role="img"
          aria-label={`${total} submissions over the last ${WEEKS} weeks`}
        >
          {months.map((month) => (
            <text
              key={`${month.week}-${month.label}`}
              x={month.week * (CELL + GAP)}
              y={9}
              className="fill-[#5a5a75] font-mono text-[9px]"
            >
              {month.label}
            </text>
          ))}

          {columns.map((column, weekIndex) =>
            column.map((cell, dayIndex) => {
              if (cell.count < 0) return null;
              const step = stepFor(cell.count, max);
              return (
                <rect
                  key={`${weekIndex}-${dayIndex}`}
                  x={weekIndex * (CELL + GAP)}
                  y={dayIndex * (CELL + GAP) + 14}
                  width={CELL}
                  height={CELL}
                  rx={2.5}
                  fill={STEPS[step]}
                  stroke={step === 0 ? '#ffffff0d' : 'transparent'}
                  onMouseEnter={(event) =>
                    setHover({
                      x: event.currentTarget.getBoundingClientRect().left,
                      y: event.currentTarget.getBoundingClientRect().top,
                      label: `${cell.count === 0 ? 'No' : cell.count} submission${
                        cell.count === 1 ? '' : 's'
                      } · ${cell.date.toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}`,
                    })
                  }
                  onMouseLeave={() => setHover(null)}
                />
              );
            }),
          )}
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-[11px] text-faint tabular">
          {total} submission{total === 1 ? '' : 's'} in {WEEKS} weeks
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-faint">Less</span>
          {STEPS.map((colour, i) => (
            <span
              key={colour}
              className="h-[10px] w-[10px] rounded-[2px]"
              style={{
                background: colour,
                border: i === 0 ? '1px solid #ffffff0d' : undefined,
              }}
            />
          ))}
          <span className="font-mono text-[10px] text-faint">More</span>
        </div>
      </div>

      {hover ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-ink-sunken px-2.5 py-1.5 font-mono text-[11px] whitespace-nowrap text-paper shadow-xl"
          style={{ left: hover.x + CELL / 2, top: hover.y - 8 }}
        >
          {hover.label}
        </div>
      ) : null}
    </div>
  );
}
