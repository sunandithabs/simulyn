import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-line-strong bg-ink-sunken/70 px-3 text-sm text-paper',
        'placeholder:text-faint transition-colors duration-200',
        'hover:border-white/25 focus:border-violet-lit focus:outline-none focus:ring-2 focus:ring-violet/40',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-9 cursor-pointer rounded-lg border border-line-strong bg-ink-sunken/70 px-2.5 pr-7 text-[13px] text-paper',
        'transition-colors duration-200 hover:border-white/25 focus:border-violet-lit focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="instrument">{label}</span>
      <div className="mt-2">{children}</div>
      {hint ? <span className="mt-1.5 block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}
