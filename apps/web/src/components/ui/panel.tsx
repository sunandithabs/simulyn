import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The one card in the product. `label` prints an instrument-style eyebrow with
 * a brass hairline, which is how every measurement is introduced.
 */
export function Panel({
  className,
  hover,
  ...props
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return <div className={cn('glass', hover && 'glass-lift', className)} {...props} />;
}

export function PanelHeader({
  label,
  title,
  action,
  className,
}: {
  label?: string;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-4', className)}>
      <div className="min-w-0">
        {label ? (
          <>
            <span className="instrument">{label}</span>
            <div className="hairline mt-1.5 w-10" />
          </>
        ) : null}
        {title ? (
          <h2 className="mt-2 text-[15px] font-semibold tracking-[-0.01em] text-paper">{title}</h2>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PanelBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}
