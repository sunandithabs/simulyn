'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';

// Quick 3-question survey (all positively worded, 1-5).
const ITEMS = [
  'Simulyn was easy to use.',
  'Simulyn helped me learn or practise.',
  'I would use Simulyn again.',
];

const SCALE = [1, 2, 3, 4, 5];

export default function SurveyPage() {
  const [answers, setAnswers] = useState<(number | null)[]>(Array(ITEMS.length).fill(null));
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .get<{ surveyed: boolean }>('/research/status')
      .then(({ surveyed }) => setDone(surveyed))
      .catch(() => setDone(false));
  }, []);

  const complete = answers.every((a) => a !== null);

  async function submit() {
    if (!complete) return;
    setSubmitting(true);
    try {
      await api.post('/research/survey', { susAnswers: answers, freeText: freeText.trim() || undefined });
      setDone(true);
      toast.success('Thanks — your feedback was recorded.');
    } catch {
      toast.error('Could not submit right now. Try again in a bit.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Panel>
          <PanelHeader label="Research study" title="A few questions before you go" />
          <PanelBody className="space-y-6">
            {done === null ? (
              <Skeleton className="h-40 w-full" />
            ) : done ? (
              <p className="text-sm text-muted">
                You&apos;ve already submitted this survey — thanks for taking part in the study.
              </p>
            ) : (
              <>
                <p className="text-[13px] text-muted">
                  Three quick questions for the Simulyn evaluation study.
                  1 = strongly disagree, 5 = strongly agree. Takes under a minute.
                </p>

                {ITEMS.map((item, i) => (
                  <div key={i} role="group" aria-labelledby={`q${i}`} className="border-t border-line pt-4 first:border-0 first:pt-0">
                    <div id={`q${i}`} className="text-[13px] text-paper">
                      {i + 1}. {item}
                    </div>
                    <div className="mt-2 flex gap-2">
                      {SCALE.map((v) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={answers[i] === v}
                          aria-label={`${v} out of 5`}
                          onClick={() =>
                            setAnswers((prev) => prev.map((a, idx) => (idx === i ? v : a)))
                          }
                          className={`h-9 w-9 rounded-md border text-[13px] transition-colors ${
                            answers[i] === v
                              ? 'border-violet-lit bg-violet/20 text-paper'
                              : 'border-line text-muted hover:border-line-strong'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-faint" style={{ width: "calc(5 * 2.25rem + 4 * 0.5rem)" }}>
                      <span>Strongly disagree</span>
                      <span>Strongly agree</span>
                    </div>
                  </div>
                ))}

                <div className="border-t border-line pt-4">
                  <label htmlFor="survey-feedback" className="text-[13px] text-paper">
                    What should we improve, or what did you like? (optional)
                  </label>
                  <Textarea
                    id="survey-feedback"
                    value={freeText}
                    maxLength={2000}
                    onChange={(e) => setFreeText(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                </div>

                <Button
                  className="w-full justify-center"
                  disabled={!complete}
                  loading={submitting}
                  onClick={submit}
                >
                  Submit
                </Button>
              </>
            )}
          </PanelBody>
        </Panel>
      </div>
    </PageTransition>
  );
}
