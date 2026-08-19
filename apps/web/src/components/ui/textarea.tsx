import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-line-strong bg-ink-sunken/70 px-3 py-2.5 text-sm text-paper',
        'placeholder:text-faint transition-colors duration-200',
        'hover:border-white/25 focus:border-violet-lit focus:outline-none focus:ring-2 focus:ring-violet/40',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
