'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { LanguageEnum, MentorHint } from '@/lib/types';

const LEVELS = [
  { value: 1, label: 'Nudge', hint: 'Points at the idea' },
  { value: 2, label: 'Hint', hint: 'Names the technique' },
  { value: 3, label: 'Approach', hint: 'Walks the algorithm' },
];

/**
 * Socratic hints. Three levels, because a student who is stuck on "where do I
 * start" needs something different from one who has the idea but not the shape.
 */
export function MentorPanel({
  problemId,
  language,
  code,
}: {
  problemId: string;
  language: LanguageEnum;
  code: string;
}) {
  const [level, setLevel] = useState(1);
  const [hint, setHint] = useState<MentorHint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<MentorHint>('/mentor/hint', {
        problemId,
        language,
        hintLevel: level,
        code,
      });
      setHint(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The mentor is unavailable right now');
      setHint(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-line bg-ink-sunken/60 p-1">
          {LEVELS.map((option) => (
            <button
              key={option.value}
              onClick={() => setLevel(option.value)}
              title={option.hint}
              className={`rounded-md px-2.5 py-1 text-[12px] transition-colors duration-200 ${
                level === option.value
                  ? 'bg-violet/25 text-paper'
                  : 'text-muted hover:text-paper'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Button variant="brass" size="sm" onClick={() => void ask()} loading={busy}>
          <Sparkles className="h-3.5 w-3.5" />
          Get a hint
        </Button>

        {hint?.cached ? <Badge>cached</Badge> : null}
        {hint ? <span className="font-mono text-[10px] text-faint">{hint.provider}</span> : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-warn/30 bg-warn/[0.07] px-3 py-2.5 text-[13px] text-warn">
          {error}
        </div>
      ) : null}

      {hint ? (
        <div className="prose-lab mt-4 rounded-lg border border-line bg-white/[0.02] p-4 text-[13.5px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{hint.text}</ReactMarkdown>
        </div>
      ) : !error ? (
        <p className="mt-4 text-[13px] text-muted">
          The mentor reads your current code and answers with a hint, never a solution. Start with a
          nudge and work up only if you need to.
        </p>
      ) : null}
    </div>
  );
}
