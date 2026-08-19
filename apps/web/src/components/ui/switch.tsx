'use client';

import { cn } from '@/lib/utils';

/**
 * `inline` is the bare pill-and-text row — right for a toggle that sits beside
 * other controls. `card` boxes it so a standalone setting carries the same
 * weight as the `Field` inputs around it, and tints violet while it is on, the
 * way every other live state in the product does.
 */
type SwitchVariant = 'inline' | 'card';

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
  variant = 'inline',
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  variant?: SwitchVariant;
}) {
  const card = variant === 'card';

  const pill = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      // The wrapping label would otherwise name the switch with the hint too.
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-200',
        checked ? 'border-violet-lit/50 bg-violet' : 'border-line-strong bg-ink-sunken',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-paper transition-transform duration-200',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );

  const text = (
    <span className="min-w-0">
      <span className="block text-[13.5px] text-paper">{label}</span>
      {hint ? <span className="mt-1 block text-xs leading-relaxed text-faint">{hint}</span> : null}
    </span>
  );

  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3',
        card &&
          'justify-between gap-4 rounded-lg border px-3.5 py-3 transition-colors duration-200',
        card &&
          (checked
            ? 'border-violet-lit/35 bg-violet/[0.07]'
            : 'border-line bg-white/[0.02] hover:border-line-strong'),
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {/* Boxed rows read left-to-right: what it does, then the control. */}
      {card ? (
        <>
          {text}
          {pill}
        </>
      ) : (
        <>
          {pill}
          {text}
        </>
      )}
    </label>
  );
}
