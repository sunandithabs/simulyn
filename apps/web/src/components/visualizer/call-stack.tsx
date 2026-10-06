import type { TraceEvent } from './types';

function brief(vars: Record<string, unknown>): string {
  const parts = Object.entries(vars)
    .slice(0, 3)
    .map(([key, value]) => {
      const text = JSON.stringify(value) ?? String(value);
      return `${key}=${text.length > 18 ? `${text.slice(0, 17)}…` : text}`;
    });
  return parts.join(', ');
}

/** Active function calls at the current step, innermost last. */
export function CallStack({ events, step }: { events: TraceEvent[]; step: number }) {
  const frames: { fn: string; vars: Record<string, unknown> }[] = [];
  for (let i = 0; i <= step && i < events.length; i++) {
    const event = events[i];
    if (!event.depth || !event.fn) continue;
    frames.length = event.depth - 1;
    frames[event.depth - 1] = { fn: event.fn, vars: event.vars };
  }
  const live = frames.filter(Boolean);
  if (live.length === 0) return null;

  return (
    <div className="border-t border-line px-5 py-3">
      <span className="instrument">Call stack · depth {live.length}</span>
      <ol className="mt-2 space-y-1">
        {live
          .map((frame, index) => ({ frame, index }))
          .reverse()
          .map(({ frame, index }) => (
            <li
              key={index}
              className={
                index === live.length - 1
                  ? 'rounded-md border border-violet-lit/40 bg-violet/15 px-2.5 py-1 font-mono text-[11.5px] text-paper'
                  : 'rounded-md border border-line px-2.5 py-1 font-mono text-[11.5px] text-muted'
              }
            >
              {frame.fn}({brief(frame.vars)})
            </li>
          ))}
      </ol>
    </div>
  );
}
