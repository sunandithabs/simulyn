'use client';

import { Activity, ClipboardList, FileClock, MessageSquareText, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Stat } from '@/components/ui/stat';
import { api } from '@/lib/api';
import type { ResearchSummary, SurveyFeedbackRow } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

/** Standard SUS items, 1-indexed; odd = positive, even = negative. */
const SUS_ITEMS = [
  'I think that I would like to use this system frequently.',
  'I found the system unnecessarily complex.',
  'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to use this system.',
  'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.',
  'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.',
  'I felt very confident using the system.',
  'I needed to learn a lot of things before I could get going with this system.',
];

const QUICK_ITEMS = [
  'Simulyn was easy to use.',
  'Simulyn helped me learn or practise.',
  'I would use Simulyn again.',
];

const fmt = (n: number | null | undefined, suffix = '') => (n === null || n === undefined ? '—' : `${n}${suffix}`);

function toneFor(score: number) {
  return score >= 68 ? 'pass' : score >= 51 ? 'warn' : 'fail';
}

export default function AdminResearchPage() {
  const [summary, setSummary] = useState<ResearchSummary | null>(null);
  const [feedback, setFeedback] = useState<SurveyFeedbackRow[] | null>(null);
  const [term, setTerm] = useState('');
  const [onlyComments, setOnlyComments] = useState(false);

  useEffect(() => {
    void api
      .get<ResearchSummary>('/research/admin/summary')
      .then(setSummary)
      .catch(() => toast.error('Could not load study statistics'));
    void api
      .get<SurveyFeedbackRow[]>('/research/admin/feedback')
      .then(setFeedback)
      .catch(() => {
        toast.error('Could not load survey feedback');
        setFeedback([]);
      });
  }, []);

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return (feedback ?? []).filter(
      (r) => (!onlyComments || r.freeText) && (!needle || (r.freeText ?? '').toLowerCase().includes(needle)),
    );
  }, [feedback, term, onlyComments]);

  const p = summary?.participants;

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header>
          <span className="instrument">Study</span>
          <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-white">
            Research &amp; feedback
          </h1>
          <p className="mt-1 text-sm text-muted">
            All student accounts, excluding any usernames listed in the API’s ANALYTICS_EXCLUDE_USERNAMES
            {summary ? ` (${summary.excludedDemoAccounts} excluded)` : ''}.
          </p>
        </header>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {!summary || !p ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
          ) : (
            <>
              <Stat icon={Users} value={p.registered} unit="real students" note={`${p.consented} consented · ${p.activeLast14Days} active (14d)`} />
              <Stat
                icon={ClipboardList}
                tone="brass"
                value={fmt(summary.sus.mean)}
                unit="mean SUS score"
                note={`n=${summary.sus.n} · median ${fmt(summary.sus.median)} · SD ${fmt(summary.sus.stdev)} · quick survey (separate): n=${summary.quick.n}, mean ${fmt(summary.quick.meanScore)}`}
              />
              <Stat
                icon={Activity}
                tone="trace"
                value={summary.usage.submissions}
                unit="submissions"
                note={`pass rate ${fmt(summary.usage.passRate, '%')} · ${p.withAtLeastOneSolve} solved ≥1`}
              />
              <Stat
                icon={FileClock}
                value={summary.exams.attempts}
                unit="exam attempts"
                note={`${summary.exams.flagged} flagged · ${summary.exams.violations} violations`}
              />
            </>
          )}
        </div>

        {summary ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader label="Usability" title="SUS distribution" />
              <div className="space-y-2 p-5 text-sm">
                {summary.sus.n === 0 ? (
                  <p className="text-muted">No survey responses yet.</p>
                ) : (
                  <>
                    <p className="font-mono text-[11px] text-faint">
                      range {fmt(summary.sus.min)} – {fmt(summary.sus.max)} · response rate{' '}
                      {fmt(p?.surveyResponseRate, '%')} ({p?.surveyed}/{p?.registered})
                    </p>
                    {Object.entries(summary.sus.bands).map(([band, count]) => (
                      <div key={band} className="flex items-center gap-3">
                        <span className="w-32 shrink-0 text-muted">{band}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded bg-white/5">
                          <div className="h-full bg-violet-lit" style={{ width: `${(count / summary.sus.n) * 100}%` }} />
                        </div>
                        <span className="w-6 text-right font-mono text-[12px] text-paper">{count}</span>
                      </div>
                    ))}
                    <p className="pt-2 text-xs text-faint">Benchmark: 68 is the commonly cited SUS average.</p>
                  </>
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader label="Usability" title="Mean rating per SUS item (1–5)" />
              <ol className="space-y-1.5 p-5 text-[13px]">
                {SUS_ITEMS.map((text, i) => (
                  <li key={i} className="flex items-baseline gap-3">
                    <span className="w-5 shrink-0 font-mono text-[11px] text-faint">Q{i + 1}</span>
                    <span className="flex-1 text-muted">{text}</span>
                    <span className="font-mono text-paper tabular">{fmt(summary.sus.itemMeans[i])}</span>
                  </li>
                ))}
              </ol>
            </Panel>

            {summary.quick.n > 0 ? (
              <Panel className="lg:col-span-2">
                <PanelHeader label="Quick survey" title={`3-question survey (n=${summary.quick.n}) · mean ${fmt(summary.quick.meanScore)}/100`} />
                <ol className="space-y-1.5 p-5 text-[13px]">
                  {QUICK_ITEMS.map((text, i) => (
                    <li key={i} className="flex items-baseline gap-3">
                      <span className="flex-1 text-muted">{text}</span>
                      <span className="font-mono text-paper tabular">{fmt(summary.quick.itemMeans[i])} / 5</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            ) : null}

            <Panel className="lg:col-span-2">
              <PanelHeader label="Usage" title="Submissions by language" />
              <div className="grid gap-3 p-5 sm:grid-cols-3">
                {Object.keys(summary.usage.perLanguage).length === 0 ? (
                  <p className="text-sm text-muted">No submissions from real users yet.</p>
                ) : (
                  Object.entries(summary.usage.perLanguage).map(([lang, v]) => (
                    <div key={lang} className="rounded-lg border border-line-strong p-3">
                      <div className="font-mono text-[11px] text-faint uppercase">{lang}</div>
                      <div className="mt-1 text-paper">
                        {v.submissions} <span className="text-muted">· {Math.round((v.passed / v.submissions) * 100)}% passed</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>
        ) : null}

        <Panel className="mt-6">
          <PanelHeader
            label="Survey"
            title={`All feedback${feedback ? ` (${rows.length}${rows.length !== feedback.length ? ` of ${feedback.length}` : ''})` : ''}`}
            action={
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={onlyComments} onChange={(e) => setOnlyComments(e.target.checked)} />
                  Comments only
                </label>
                <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search comments" aria-label="Search comments" className="w-48" />
              </div>
            }
          />
          <div className="p-5">
            {!feedback ? (
              <Skeleton className="h-32 w-full" />
            ) : rows.length === 0 ? (
              <Empty
                icon={MessageSquareText}
                title="No feedback yet"
                description="Responses from real students appear here as soon as they finish the exit survey."
              />
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((r) => (
                  <li key={r.id} className="py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] text-paper">{r.participant}</span>
                      <Badge tone={r.kind === 'SUS' && r.susScore !== null ? toneFor(r.susScore) : 'neutral'}>
                        {r.kind === 'SUS' ? `SUS ${r.susScore ?? '–'}` : `Quick ${r.quickScore ?? '–'}/100 (not SUS)`}
                      </Badge>
                      <span className="font-mono text-[11px] text-faint">{formatDateTime(r.submittedAt)}</span>
                    </div>
                    <p className={`mt-2 text-sm whitespace-pre-wrap ${r.freeText ? 'text-paper' : 'text-faint italic'}`}>
                      {r.freeText ?? 'No written comment'}
                    </p>
                    <p className="mt-1.5 font-mono text-[11px] text-faint">answers: {r.answers.join(' · ')}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </PageTransition>
  );
}
