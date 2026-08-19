'use client';

import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const SPEEDS = [0.5, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

/**
 * Transport for the trace, styled as the instrument panel the rest of the
 * product uses: mono labels, tabular numerals, brass for the readout.
 */
export function PlaybackControls({
  step,
  total,
  playing,
  speed,
  onPlayPause,
  onSeek,
  onSpeed,
  disabled,
}: {
  step: number;
  total: number;
  playing: boolean;
  speed: Speed;
  onPlayPause: () => void;
  onSeek: (step: number) => void;
  onSpeed: (speed: Speed) => void;
  disabled?: boolean;
}) {
  return (
    <div className="border-t border-line bg-ink-sunken/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous step"
            disabled={disabled || step <= 0}
            onClick={() => onSeek(step - 1)}
          >
            <SkipBack className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant={playing ? 'brass' : 'primary'}
            size="icon"
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={disabled || total === 0}
            onClick={onPlayPause}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Next step"
            disabled={disabled || step >= total - 1}
            onClick={() => onSeek(step + 1)}
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-line bg-ink-sunken p-0.5">
          {SPEEDS.map((option) => (
            <button
              key={option}
              disabled={disabled}
              onClick={() => onSpeed(option)}
              aria-pressed={speed === option}
              className={cn(
                'rounded-md px-2 py-1 font-mono text-[11px] transition-colors duration-200',
                speed === option ? 'bg-violet/25 text-paper' : 'text-muted hover:text-paper',
              )}
            >
              {option}x
            </button>
          ))}
        </div>

        <div className="ml-auto text-right">
          <span className="instrument">Step</span>
          <div className="font-mono text-[13px] text-brass-lit tabular">
            {total === 0 ? '—' : `${step + 1} / ${total}`}
          </div>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={step}
        disabled={disabled || total === 0}
        onChange={(event) => onSeek(Number(event.target.value))}
        aria-label="Scrub through the trace"
        className="viz-scrubber mt-3 w-full"
      />
    </div>
  );
}
