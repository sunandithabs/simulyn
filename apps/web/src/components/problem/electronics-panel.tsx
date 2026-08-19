'use client';

import { CheckCircle2, XCircle, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CircuitView, type ProbeState } from '@/components/visualizer/circuit/circuit-view';
import { buildSchematic } from '@/components/visualizer/circuit/templates';
import { WaveformView } from '@/components/visualizer/circuit/waveform-view';
import { api } from '@/lib/api';
import type { ElectronicsQuestion, ElectronicsResult } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Electronics problems are answered with numbers, not code. Each answer is
 * checked against the key within the tolerance the author set.
 */
export function ElectronicsPanel({
  problemId,
  category,
  questions,
  params,
}: {
  problemId: string;
  category: string;
  questions: ElectronicsQuestion[];
  params: Record<string, unknown> | null;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ElectronicsResult | null>(null);
  const [busy, setBusy] = useState(false);

  const outcomeFor = (id: string) => result?.results.find((row) => row.questionId === id);

  // Once answers are checked, the matching probe point on the schematic glows.
  const probes: ProbeState = Object.fromEntries(
    (result?.results ?? []).map((row) => [row.questionId, row.correct ? 'correct' : 'wrong']),
  );

  const schematic = buildSchematic(category, params);

  async function submit() {
    setBusy(true);
    try {
      const payload = questions.map((question) => ({
        questionId: question.id,
        value: answers[question.id] ?? '',
      }));
      const response = await api.post<ElectronicsResult>('/electronics/submit', {
        problemId,
        answers: payload,
      });
      setResult(response);
      if (response.allCorrect) toast.success('Every answer is within tolerance');
      else toast.error(`${response.correctCount} of ${response.totalCount} correct`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not check your answers');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {schematic ? (
        <div className="glass overflow-hidden">
          <div className="px-4 pt-4">
            <span className="instrument">Circuit</span>
            <div className="hairline mt-1.5 w-10" />
          </div>

          <CircuitView
            category={category}
            params={params}
            probes={probes}
            className="mt-2 h-[260px] w-full sm:h-[300px]"
          />

          <p className="border-t border-line px-4 py-2 font-mono text-[10px] text-faint">
            Click a component for its value. Probe points turn green once the matching answer is
            within tolerance.
          </p>
        </div>
      ) : params && Object.keys(params).length > 0 ? (
        // No layout matches this circuit, so fall back to the raw values.
        <div className="glass p-4">
          <span className="instrument">Circuit parameters</span>
          <div className="hairline mt-1.5 w-10" />
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {Object.entries(params).map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-2">
                <dt className="font-mono text-[11px] text-faint">{key}</dt>
                <dd className="font-mono text-[13px] text-brass-lit tabular">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {schematic?.waveform ? (
        <div className="glass overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4">
            <div>
              <span className="instrument">Response</span>
              <div className="hairline mt-1.5 w-10" />
            </div>
            <span className="font-mono text-[10px] text-faint">simulated from the values above</span>
          </div>
          <WaveformView kind={schematic.waveform} params={params} className="mt-2 block h-[150px] w-full" />
        </div>
      ) : null}

      <div className="glass p-4">
        <span className="instrument">Measurements</span>
        <div className="hairline mt-1.5 w-10" />

        <div className="mt-4 space-y-3">
          {questions.map((question) => {
            const outcome = outcomeFor(question.id);
            return (
              <div
                key={question.id}
                className={cn(
                  'rounded-lg border p-3 transition-colors',
                  outcome?.correct === true && 'border-trace/30 bg-trace/[0.05]',
                  outcome?.correct === false && 'border-fault/30 bg-fault/[0.05]',
                  !outcome && 'border-line',
                )}
              >
                <label className="block text-[13.5px] text-paper" htmlFor={`q-${question.id}`}>
                  {question.text}
                </label>

                <div className="mt-2.5 flex items-center gap-2">
                  <Input
                    id={`q-${question.id}`}
                    inputMode="decimal"
                    value={answers[question.id] ?? ''}
                    onChange={(event) =>
                      setAnswers((previous) => ({
                        ...previous,
                        [question.id]: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    className="h-9 max-w-[10rem] font-mono"
                  />
                  {question.unit ? (
                    <span className="font-mono text-[13px] text-brass-lit">{question.unit}</span>
                  ) : null}
                  <span className="ml-auto font-mono text-[10px] text-faint">
                    ± {question.tolerance}
                  </span>
                  {outcome ? (
                    outcome.correct ? (
                      <CheckCircle2 className="h-4 w-4 text-trace" strokeWidth={1.8} />
                    ) : (
                      <XCircle className="h-4 w-4 text-fault" strokeWidth={1.8} />
                    )
                  ) : null}
                </div>

                {outcome && !outcome.correct ? (
                  <p className="mt-2 font-mono text-[11px] text-fault">
                    {outcome.actual === null
                      ? 'No value entered'
                      : `${outcome.actual} is outside the ± ${outcome.tolerance} band`}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={() => void submit()} loading={busy}>
            <Zap className="h-4 w-4" />
            Check answers
          </Button>
          {result ? (
            <span
              className={cn(
                'font-mono text-[12px] tabular',
                result.allCorrect ? 'text-trace' : 'text-muted',
              )}
            >
              {result.correctCount}/{result.totalCount} correct · {result.score} pts
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
