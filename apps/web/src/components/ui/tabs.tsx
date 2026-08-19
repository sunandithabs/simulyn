'use client';

import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Controlled segmented control. Underline sits on the active tab. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-line', className)} role="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative px-3 py-2.5 text-[13px] font-medium transition-colors duration-200',
              active ? 'text-paper' : 'text-muted hover:text-paper',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="ml-1.5 font-mono text-[11px] text-faint tabular">{item.count}</span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet-lit" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
