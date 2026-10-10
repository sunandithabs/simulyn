'use client';

import { Printer } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface MyReport {
  user: { displayName: string; username: string };
  generatedAt: string;
  submissions: number;
  accuracy: number;
  problemsSolved: number;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  categories: { category: string; attempts: number; accuracy: number }[];
  weakTopics: { category: string; attempts: number; accuracy: number }[];
}

const tone = (v: number) => (v >= 70 ? 'text-trace' : v >= 40 ? 'text-warn' : 'text-fault');

export default function StudentReportPage() {
  const [r, setR] = useState<MyReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void api.get<MyReport>('/me/report').then(setR).catch(() => setFailed(true));
  }, []);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 print:max-w-none print:p-0">
        <div className="flex items-end justify-between gap-4 print:hidden">
          <header>
            <span className="instrument">Progress</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">My report</h1>
          </header>
          <Button variant="outline" size="sm" disabled={!r} onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>

        {failed ? (
          <p className="text-sm text-muted">Could not load your report.</p>
        ) : !r ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <Panel className="print:border-0 print:bg-white print:text-black print:shadow-none">
            <PanelHeader
              label="Progress report"
              title={`${r.user.displayName} (@${r.user.username})`}
              action={<span className="text-xs text-muted">{new Date(r.generatedAt).toLocaleString()}</span>}
            />
            <div className="space-y-5 p-5">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ['Accuracy', `${r.accuracy}%`, tone(r.accuracy)],
                  ['Problems solved', String(r.problemsSolved), ''],
                  ['Submissions', String(r.submissions), ''],
                  ['Level / XP', `${r.level} / ${r.xp.toLocaleString()}`, ''],
                  ['Current streak', `${r.currentStreak} d`, ''],
                  ['Longest streak', `${r.longestStreak} d`, ''],
                ].map(([k, v, c]) => (
                  <div key={k}>
                    <dt className="text-xs uppercase tracking-wide text-faint">{k}</dt>
                    <dd className={cn('font-mono text-lg tabular text-paper', c)}>{v}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h2 className="mb-2 text-sm font-medium text-paper">Focus next</h2>
                <p className="text-sm text-muted">
                  {r.weakTopics.length
                    ? r.weakTopics.map((t) => `${t.category} (${t.accuracy}% over ${t.attempts} attempts)`).join(', ')
                    : 'No weak topics yet — keep going.'}
                </p>
              </div>

              <div>
                <h2 className="mb-2 text-sm font-medium text-paper">Accuracy by topic</h2>
                {r.categories.length === 0 ? (
                  <p className="text-sm text-muted">No submissions yet.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-line">
                      {r.categories.map((c) => (
                        <tr key={c.category}>
                          <td className="py-1.5 text-paper">{c.category}</td>
                          <td className="text-faint">{c.attempts} attempts</td>
                          <td className={cn('text-right font-mono tabular', tone(c.accuracy))}>{c.accuracy}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </Panel>
        )}
      </div>
    </PageTransition>
  );
}
