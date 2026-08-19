import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Empty states are an invitation to act: say what is missing and what to do
 * about it, never just "no data".
 */
export function Empty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-violet/20 blur-2xl" />
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-line-strong bg-white/[0.04]">
          <Icon className="h-6 w-6 text-violet-lit" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-paper">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
