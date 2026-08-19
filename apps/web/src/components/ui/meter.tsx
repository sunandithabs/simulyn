import { cn } from '@/lib/utils';

/**
 * Level meter, styled like a bench instrument: a filled bar with hairline tick
 * marks at each level threshold, so progress is read against a real scale
 * rather than an abstract percentage.
 */
export function LevelMeter({
  xp,
  level,
  thresholds,
  className,
  compact,
}: {
  xp: number;
  level: number;
  thresholds: number[];
  className?: string;
  compact?: boolean;
}) {
  const floor = thresholds[level - 1] ?? 0;
  const ceiling = thresholds[level] ?? floor;
  const span = Math.max(1, ceiling - floor);
  const atMax = level >= thresholds.length;
  const progress = atMax ? 1 : Math.min(1, Math.max(0, (xp - floor) / span));
  const remaining = atMax ? 0 : Math.max(0, ceiling - xp);

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="instrument">Level {level}</span>
        <span className="font-mono text-[11px] text-brass-lit tabular">
          {atMax ? 'MAX' : `${remaining.toLocaleString()} XP to L${level + 1}`}
        </span>
      </div>

      <div
        className={cn(
          'relative mt-1.5 overflow-hidden rounded-full border border-line bg-ink-sunken',
          compact ? 'h-1.5' : 'h-2',
        )}
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Level ${level} progress`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet to-violet-lit transition-[width] duration-700 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
        {/* Quarter ticks — the scale that makes this read as an instrument. */}
        {[0.25, 0.5, 0.75].map((tick) => (
          <span
            key={tick}
            className="absolute top-0 h-full w-px bg-ink/70"
            style={{ left: `${tick * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
