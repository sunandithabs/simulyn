'use client';

import { Palette } from 'lucide-react';
import { useState } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';

export function ThemeSwitcher() {
  const { themeId, setThemeId } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-paper"
        title="Customize theme"
        aria-label="Customize theme"
      >
        <Palette className="h-4 w-4" />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass absolute right-0 z-50 mt-2 w-52 p-2">
            <div className="instrument px-2 py-1.5">Theme</div>
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => {
                  setThemeId(theme.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] transition-colors hover:bg-white/5',
                  themeId === theme.id ? 'text-paper' : 'text-muted',
                )}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${theme.vars['--color-violet-lit']}, ${theme.vars['--color-brass-lit']})`,
                  }}
                />
                {theme.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
