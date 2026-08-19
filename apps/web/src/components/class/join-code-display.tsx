'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * The join code, sized to be read from the back of a room.
 *
 * This is a projection surface, not a dialog: an instructor puts it on the
 * screen and the class types the code in. So it fills the viewport, drops
 * everything except the code itself, and spaces the characters out so a 0 and
 * an O can be told apart at distance.
 */
export function JoinCodeDisplay({
  open,
  code,
  name,
  onClose,
}: {
  open: boolean;
  code: string;
  /** Class name, shown above the code so the room knows which one it is. */
  name: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the code is on screen regardless.
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Join code for ${name}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-6 py-10 text-center"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 rounded-md p-2 text-muted transition-colors hover:bg-white/5 hover:text-paper"
          >
            <X className="h-5 w-5" />
          </button>

          <span className="instrument">Join code</span>
          <h2 className="mt-3 max-w-3xl text-[clamp(1rem,2.5vw,1.5rem)] font-medium text-muted">
            {name}
          </h2>

          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1], delay: 0.05 }}
            className="mt-8 font-mono text-[clamp(3.5rem,17vw,13rem)] leading-none font-bold tracking-[0.12em] text-brass-lit tabular"
          >
            {code}
          </motion.div>

          <p className="mt-10 max-w-md text-[15px] text-muted">
            Sign in to SIMULYN, open your dashboard and choose{' '}
            <span className="text-paper">Join a class</span>.
          </p>

          <button
            onClick={() => void copy()}
            className="mt-6 flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-[13px] text-paper transition-colors hover:border-brass/60"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-trace" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-brass-lit" />
                Copy code
              </>
            )}
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
