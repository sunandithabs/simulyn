'use client';

import { Lightbulb, Lock } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Badge, DifficultyBadge } from '@/components/ui/badge';
import type { Problem } from '@/lib/types';

/**
 * The problem statement. Hints stay locked behind an explicit click and reveal
 * one level at a time, so a student cannot skim to the answer by accident.
 */
export function ProblemBrief({
  problem,
  hideHints,
}: {
  problem: Problem;
  /** Exams pass this: the hints section is not rendered at all. */
  hideHints?: boolean;
}) {
  const [revealed, setRevealed] = useState(0);
  const hints = hideHints ? [] : (problem.hints ?? []);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyBadge value={problem.difficulty} />
          <Badge>{problem.category}</Badge>
          <span className="font-mono text-[11px] text-brass-lit tabular">
            {problem.points} pts
          </span>
        </div>
        <h1 className="mt-3 text-[24px] leading-tight font-semibold tracking-[-0.03em] text-white">
          {problem.title}
        </h1>
        {problem.tags.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {problem.tags.map((tag) => (
              <span key={tag} className="font-mono text-[10px] text-faint">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <div className="prose-lab text-[14px]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.description}</ReactMarkdown>
      </div>

      {problem.examples && problem.examples.length > 0 ? (
        <section>
          <span className="instrument">Examples</span>
          <div className="hairline mt-1.5 w-10" />
          <div className="mt-3 space-y-3">
            {problem.examples.map((example, index) => (
              <div key={index} className="rounded-lg border border-line bg-ink-sunken/60 p-3">
                <div className="grid gap-1.5">
                  <div className="grid grid-cols-[64px_1fr] gap-3">
                    <span className="instrument pt-0.5">Input</span>
                    <code className="font-mono text-[12px] text-paper">{example.input}</code>
                  </div>
                  <div className="grid grid-cols-[64px_1fr] gap-3">
                    <span className="instrument pt-0.5">Output</span>
                    <code className="font-mono text-[12px] text-trace">{example.output}</code>
                  </div>
                  {example.explanation ? (
                    <div className="grid grid-cols-[64px_1fr] gap-3">
                      <span className="instrument pt-0.5">Why</span>
                      <span className="text-[12.5px] text-muted">{example.explanation}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {problem.constraints.length > 0 ? (
        <section>
          <span className="instrument">Constraints</span>
          <div className="hairline mt-1.5 w-10" />
          <ul className="mt-3 space-y-1.5">
            {problem.constraints.map((constraint) => (
              <li key={constraint} className="flex gap-2 font-mono text-[12px] text-muted">
                <span className="text-faint">·</span>
                {constraint}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hints.length > 0 ? (
        <section>
          <span className="instrument">Hints</span>
          <div className="hairline mt-1.5 w-10" />
          <div className="mt-3 space-y-2">
            {hints.map((hint, index) => {
              const open = index < revealed;
              return (
                <div
                  key={hint.id}
                  className="rounded-lg border border-line bg-white/[0.02] transition-colors"
                >
                  {open ? (
                    <div className="p-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-3.5 w-3.5 text-brass-lit" strokeWidth={1.8} />
                        <span className="instrument">Hint {hint.level}</span>
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed text-paper">{hint.text}</p>
                    </div>
                  ) : index === revealed ? (
                    <button
                      onClick={() => setRevealed(index + 1)}
                      className="flex w-full items-center gap-2 p-3 text-left text-[13px] text-muted transition-colors hover:text-paper"
                    >
                      <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Reveal hint {hint.level} of {hints.length}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 p-3 text-[13px] text-faint">
                      <Lock className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Hint {hint.level}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
