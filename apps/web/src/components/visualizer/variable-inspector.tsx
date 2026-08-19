'use client';

import { changedKeys } from './draw';
import type { TraceEvent } from './types';
import { cn } from '@/lib/utils';

function typeOf(value: unknown): string {
  if (value === null || value === undefined) return 'none';
  if (Array.isArray(value)) return `list[${value.length}]`;
  if (typeof value === 'object') return `dict[${Object.keys(value).length}]`;
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
  return typeof value;
}

function render(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'string') return `"${value}"`;
  const text = JSON.stringify(value);
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

/**
 * Every variable in scope at the current step. A value that differs from the
 * previous step flashes amber, which is usually the fastest way to spot what a
 * line actually did.
 */
export function VariableInspector({
  event,
  previous,
}: {
  event: TraceEvent | null;
  previous: TraceEvent | null;
}) {
  if (!event) {
    return (
      <p className="px-4 py-6 text-center font-mono text-[11px] text-faint">
        Run your code to inspect its variables step by step.
      </p>
    );
  }

  const entries = Object.entries(event.vars);
  const changed = changedKeys(event.vars, previous?.vars);

  if (entries.length === 0) {
    return (
      <p className="px-4 py-6 text-center font-mono text-[11px] text-faint">
        Nothing in scope at this step.
      </p>
    );
  }

  return (
    <table className="w-full font-mono text-[11.5px]">
      <thead>
        <tr className="border-b border-line">
          <th className="instrument px-4 py-2 text-left font-normal">Name</th>
          <th className="instrument px-2 py-2 text-left font-normal">Type</th>
          <th className="instrument px-4 py-2 text-left font-normal">Value</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([name, value]) => {
          const didChange = changed.has(name);
          return (
            <tr
              key={name}
              // The key includes the step so React remounts the row and the
              // animation replays on every change.
              className={cn(
                'border-b border-line/60 last:border-b-0',
                didChange && 'viz-flash',
              )}
            >
              <td className="px-4 py-1.5 whitespace-nowrap text-paper">{name}</td>
              <td className="px-2 py-1.5 whitespace-nowrap text-faint">{typeOf(value)}</td>
              <td
                className={cn(
                  'px-4 py-1.5 break-all',
                  didChange ? 'text-warn' : 'text-muted',
                )}
              >
                {render(value)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
