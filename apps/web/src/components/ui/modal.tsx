'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Centred dialog. Escape closes it, and the body scroll is locked while open. */
export function Modal({
  open,
  onClose,
  label,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  label?: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/80 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              'glass relative z-10 my-auto w-full max-w-lg bg-ink-raised shadow-2xl',
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0">
                {label ? (
                  <>
                    <span className="instrument">{label}</span>
                    <div className="hairline mt-1.5 w-10" />
                  </>
                ) : null}
                <h2 className="mt-2 text-[17px] font-semibold tracking-[-0.02em] text-white">
                  {title}
                </h2>
                {description ? (
                  <p className="mt-1 text-[13px] text-muted">{description}</p>
                ) : null}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-paper"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[65dvh] overflow-y-auto px-5 py-4">{children}</div>

            {footer ? (
              <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
