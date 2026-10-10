'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const VERSION = '2.0';
const KEY = 'simulyn.whatsnew';
const SECTIONS: [string, string[]][] = [
  ['New', ['Hackathons: teams, invites, scoring, leaderboard', 'Notifications bell and announcements', 'Submissions tab on every problem']],
  ['Improvements', ['Larger hidden test cases to check efficiency', 'Easy and long cases in the visualizer', 'Demo accounts separated from real leaderboard']],
  ['Fixes', ['Styling broken by a Content-Security-Policy typo', 'Visualizer type errors']],
];

export function WhatsNew() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(KEY) !== VERSION) setOpen(true); } catch {}
  }, []);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(KEY, VERSION); } catch {}
  };

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="font-mono text-[11px] text-muted hover:text-paper">v{VERSION}</button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div className="w-full max-w-md rounded-xl border border-line bg-[#0b0b12] p-5 text-paper" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">What&apos;s new in v{VERSION}</h2>
              <button onClick={close} aria-label="Close" className="text-muted hover:text-paper">✕</button>
            </div>
            {SECTIONS.map(([title, items]) => (
              <div key={title} className="mb-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">{title}</div>
                <ul className="list-disc space-y-0.5 pl-5 text-[13px]">{items.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
