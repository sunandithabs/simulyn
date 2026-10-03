'use client';

import { cn } from '@/lib/utils';

import type { Frame } from './types';

function brief(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'string') return `"${value.length > 14 ? `${value.slice(0, 13)}…` : value}"`;
  if (Array.isArray(value)) {
    const text = JSON.stringify(value);
    return text.length > 28 ? `list[${value.length}]` : text;
  }
  if (typeof value === 'object') return `dict[${Object.keys(value).length}]`;
  return String(value);
}

/**
 * The live calls, innermost first, like the stack a debugger shows. Each row
 * is one call: the function, the line it is paused on, and its locals. It is
 * what makes a recursive solution readable — the tree or list view shows the
 * data, this shows which call is working on which part of it.
 */
export function CallStack({ frames }: { frames: Frame[] }) {
  if (frames.length === 0) return null;
  const innermost = frames.length - 1;

  return (
    <div className="border-t border-line">
      <div className="flex items-baseline justify-between px-5 pt-3">
        <span className="instrument">Call stack</span>
        <span className="font-mono text-[10.5px] text-faint tabular">
          {frames.length} {frames.length === 1 ? 'call' : 'calls'} deep
        </span>
      </div>
      <ol className="px-3 py-2">
        {frames
          .map((frame, index) => ({ frame, index }))
          .reverse()
          .map(({ frame, index }) => {
            const locals = Object.entries(frame.vars).slice(0, 4);
            return (
              <li
                key={`${frame.depth}-${index}`}
                className={cn(
                  'mb-1 rounded-md border px-2.5 py-1.5 font-mono text-[11.5px]',
                  index === innermost
                    ? 'border-brass/40 bg-brass/[0.07] text-paper'
                    : 'border-line bg-white/[0.02] text-muted',
                )}
                style={{ marginLeft: `${Math.min(index, 8) * 6}px` }}
              >
                <div className="flex items-center gap-2">
                  <span className={index === innermost ? 'text-brass-lit' : 'text-paper'}>{frame.fn}</span>
                  {frame.line ? <span className="text-faint">line {frame.line}</span> : null}
                  {index === innermost ? (
                    <span className="ml-auto text-[10px] tracking-wide text-brass-lit uppercase">here</span>
                  ) : null}
                </div>
                {locals.length > 0 ? (
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    {locals.map(([name, value]) => (
                      <span key={name}>
                        <span className="text-faint">{name}=</span>
                        {brief(value)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
      </ol>
    </div>
  );
}
