import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';
import type { Difficulty } from '@/lib/types';

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] tracking-[0.08em] uppercase',
  {
    variants: {
      tone: {
        neutral: 'border-line-strong bg-white/5 text-muted',
        violet: 'border-violet-lit/35 bg-violet/20 text-violet-lit',
        brass: 'border-brass/35 bg-brass/12 text-brass-lit',
        pass: 'border-trace/35 bg-trace/12 text-trace',
        fail: 'border-fault/35 bg-fault/12 text-fault',
        warn: 'border-warn/35 bg-warn/12 text-warn',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

const DIFFICULTY_TONE: Record<Difficulty, VariantProps<typeof badge>['tone']> = {
  EASY: 'pass',
  MEDIUM: 'warn',
  HARD: 'fail',
};

export function DifficultyBadge({ value }: { value: Difficulty }) {
  return <Badge tone={DIFFICULTY_TONE[value]}>{value}</Badge>;
}
