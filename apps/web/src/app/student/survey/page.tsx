'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { api } from '@/lib/api';

// Standard 10-item System Usability Scale. Odd items are phrased positively,
// even items negatively — that alternation is part of the instrument, not a
// mistake, and the scoring in the backend accounts for it.
const ITEMS = [
  'I think that I would like to use Simulyn frequently.',
  'I found Simulyn unnecessarily complex.',
  'I thought Simulyn was easy to use.',
  'I think I would need help from a technical person to use Simulyn.',
  'I found the various functions in Simulyn well integrated.',
  'I thought there was too much inconsistency in Simulyn.',
  'I would imagine most people would learn to use Simulyn very quickly.',
  'I found Simulyn very cumbersome/awkward to use.',
  'I felt very confident using Simulyn.',
  'I needed to learn a lot of things before I could get going with Simulyn.',
];

const SCALE = [1, 2, 3, 4, 5];

export default function SurveyPage() {
  const [answers, setAnswers] = useState<(number | null)[]>(Array(10).fill(null));
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
      await api.post('/research/survey', { susAnswers: answers, freeText: freeText || undefined });
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
      <div className="mx-auto max-w-2xl">
        <Panel>
          <PanelHeader label="Research study" title="A few questions before you go" />
          <PanelBody className="space-y-6">
            {done ? (
              <p className="text-sm text-muted">
                You've already submitted this survey — thanks for taking part in the study.
              </p>
            ) : (
              <>
                <p className="text-[13px] text-muted">
                  This is a standard usability questionnaire (SUS) for the Simulyn evaluation
                  study. 1 = strongly disagree, 5 = strongly agree. Takes about 2 minutes.
                </p>

                {ITEMS.map((item, i) => (
                  <div key={i} className="border-t border-line pt-4 first:border-0 first:pt-0">
                    <div className="text-[13px] text-paper">
                      {i + 1}. {item}
                    </div>
                    <div className="mt-2 flex gap-2">
                      {SCALE.map((v) => (
                        <button
                          key={v}
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
                  </div>
                ))}

                <div className="border-t border-line pt-4">
                  <label className="text-[13px] text-paper">
                    Anything else you'd like to tell us? (optional)
                  </label>
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-line bg-black/20 p-3 text-[13px] text-paper outline-none focus:border-violet-lit/60"
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
