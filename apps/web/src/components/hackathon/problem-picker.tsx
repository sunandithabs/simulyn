'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge, DifficultyBadge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api, query } from '@/lib/api';
import type { Paginated, Problem } from '@/lib/types';
import { cn } from '@/lib/utils';

const MAX_PROBLEMS = 30;

/** Searchable list of published problems; selected ids are reported in pick order. */
export function ProblemPicker({
  value,
  onChange,
  initial,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Already-selected problems (e.g. when editing) so chips show titles, not ids. */
  initial?: { id: string; title: string }[];
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<Problem[] | null>(null);
  const [known, setKnown] = useState<Record<string, { title: string }>>(() =>
    Object.fromEntries((initial ?? []).map((p) => [p.id, { title: p.title }])),
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setResults(null);
    api
      .get<Paginated<Problem>>(
        `/problems${query({ search: debounced, isPublished: true, limit: 50, sortBy: 'title', order: 'asc' })}`,
      )
      .then((r) => {
        if (cancelled) return;
        setResults(r.data);
        setKnown((prev) => ({ ...prev, ...Object.fromEntries(r.data.map((p) => [p.id, p])) }));
      })
      .catch(() => !cancelled && setResults([]));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const selected = useMemo(() => new Set(value), [value]);
  const full = value.length >= MAX_PROBLEMS;

  function toggle(id: string) {
    if (selected.has(id)) onChange(value.filter((v) => v !== id));
    else if (!full) onChange([...value, id]);
  }

  return (
    <div className="space-y-3">
      {value.length ? (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="flex items-center gap-1.5 rounded-md border border-line bg-white/5 px-2 py-1 text-[12px] text-paper hover:bg-white/10"
              aria-label={`Remove ${known[id]?.title ?? id}`}
            >
              {known[id]?.title ?? id}
              <X className="h-3 w-3 text-muted" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
        <Input
          className="pl-9"
          aria-label="Search published problems"
          placeholder="Search published problems by title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
        {!results ? (
          <Skeleton className="h-24 w-full" />
        ) : results.length === 0 ? (
          <p className="p-4 text-sm text-muted">No published problems match.</p>
        ) : (
          <ul className="divide-y divide-line">
            {results.map((p) => {
              const on = selected.has(p.id);
              const blocked = !on && full;
              return (
                <li key={p.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-white/5',
                      blocked && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <input type="checkbox" checked={on} disabled={blocked} onChange={() => toggle(p.id)} />
                    <span className="min-w-0 flex-1 truncate text-paper">{p.title}</span>
                    <Badge tone="neutral">{p.type === 'PROGRAMMING' ? 'Code' : 'Electronics'}</Badge>
                    <DifficultyBadge value={p.difficulty} />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-xs text-faint">
        {value.length} selected{full ? ` (maximum ${MAX_PROBLEMS})` : ''}
      </p>
    </div>
  );
}
