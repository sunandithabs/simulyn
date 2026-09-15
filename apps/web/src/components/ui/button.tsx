'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-violet text-white shadow-[0_0_0_1px_#a78bfa33,0_8px_24px_-12px_#7352b8] hover:bg-violet-lit hover:text-ink',
        brass:
          'bg-violet/15 text-violet-lit border border-violet-lit/40 hover:bg-violet/25 hover:border-violet-lit/70',
        outline: 'border border-violet-lit/40 text-violet-lit hover:bg-violet/15 hover:border-violet-lit/70',
        ghost: 'text-violet-lit hover:text-white hover:bg-violet/15',
        danger: 'bg-violet/15 text-violet-lit border border-violet-lit/40 hover:bg-violet/25 hover:border-violet-lit/70',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
