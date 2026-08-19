'use client';

import { Activity } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Opens the visualiser. Pulses while a visualisation is available but unseen,
 * then settles once the student has opened it — a nudge, not a nag.
 */
export function VizTrigger({
  onClick,
  active,
  pulse,
}: {
  onClick: () => void;
  active: boolean;
  pulse: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title="Visualize this problem"
      aria-label="Visualize this problem"
      aria-pressed={active}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200',
        active
          ? 'border-violet-lit/60 bg-violet/25 text-paper'
          : 'border-line-strong text-muted hover:border-violet-lit/50 hover:text-paper',
        pulse && !active && 'viz-pulse',
      )}
    >
      <Activity className="h-4 w-4" strokeWidth={1.8} />
    </button>
  );
}
