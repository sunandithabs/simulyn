import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A single reading. The value is the hero; the unit sits under it in the mono
 * utility face, which is how every measurement is presented in this product.
 */
export function Stat({
  icon: Icon,
  value,
  unit,
  note,
  tone = 'violet',
  className,
}: {
  icon: LucideIcon;
  value: string | number;
  unit: string;
  note?: string;
  tone?: 'violet' | 'brass' | 'trace';
  className?: string;
}) {
  const tones = {
    violet: 'text-violet-lit',
    brass: 'text-brass-lit',
    trace: 'text-trace',
  } as const;

  return (
    <div className={cn('glass glass-lift p-4', className)}>
      <div className="flex items-start justify-between">
        <Icon className={cn('h-[18px] w-[18px]', tones[tone])} strokeWidth={1.6} />
        {note ? <span className="font-mono text-[10px] text-faint">{note}</span> : null}
      </div>
      <div className="mt-3 text-[28px] leading-none font-semibold tracking-[-0.04em] text-paper tabular">
        {value}
      </div>
      <div className="instrument mt-1.5">{unit}</div>
    </div>
  );
}
