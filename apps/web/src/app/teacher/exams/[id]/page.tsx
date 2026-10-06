'use client';

import { ArrowLeft, Download, Eye, EyeOff, Radio, ShieldAlert, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge, DifficultyBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Stat } from '@/components/ui/stat';
import { api } from '@/lib/api';
import type { ExamDetail, ExamResults } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

/** Integrity bands mirror the proctor grid: 85+ clean, 60+ watch, below flagged. */
function integrityTone(score: number): string {
  if (score >= 85) return 'text-trace';
  if (score >= 60) return 'text-warn';
  return 'text-fault';
}

function toCsv(results: ExamResults): string {
  const header = [
    'student',
    'username',
    'status',
    'score',
    'max_score',
    'percentage',
    'integrity_score',
    'violations',
    'submissions',
    'time_taken_min',
    'started_at',
    'submitted_at',
    'auto_submitted',
  ];

  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const rows = results.attempts.map((attempt) =>
    [
      attempt.user.displayName,
      attempt.user.username,
      attempt.status,
      attempt.totalScore,
      attempt.maxScore,
      attempt.percentage,
      attempt.integrityScore,
      attempt.violationCount,
      attempt.submissionCount,
      attempt.timeTakenMin,
      attempt.startedAt,
      attempt.submittedAt,
      attempt.autoSubmitted,
    ].map(escape),
  );

  const absent = results.notStarted.map((row) =>
    [row.user.displayName, row.user.username, 'NOT_STARTED', 0, results.exam.maxScore, 0, '', '', '', '', '', '', ''].map(
      escape,
    ),
  );

  return [header.join(','), ...rows.map((r) => r.join(',')), ...absent.map((r) => r.join(','))].join('\n');
}

export default function ExamDetailPage() {
  const params = useParams<{ id: string }>();
  const examId = params.id;

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [results, setResults] = useState<ExamResults | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    void api.get<ExamDetail>(`/exams/${examId}`).then(setExam).catch(() => undefined);
    void api
      .get<ExamResults>(`/exams/${examId}/results`)
      .then(setResults)
      .catch(() => setResults(null));
  }, [examId]);

  async function setPublished(isPublished: boolean) {
    setPublishing(true);
    try {
      const updated = await api.patch<ExamDetail>(`/exams/${examId}`, { isPublished });
      setExam((previous) => (previous ? { ...previous, ...updated } : updated));
      toast.success(
        isPublished ? 'Exam published' : 'Exam unpublished',
        {
          description: isPublished
            ? 'Students can see it now, and can start it inside the window.'
            : 'It is hidden from students again.',
        },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change the exam');
    } finally {
      setPublishing(false);
    }
  }

  function exportCsv() {
    if (!results) return;
    const blob = new Blob([toCsv(results)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${results.exam.title.replace(/[^\w-]+/g, '-').toLowerCase()}-results.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Results exported');
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/teacher/exams"
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-paper"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All exams
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <span className="instrument">{exam?.class.name ?? 'Exam'}</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              {exam?.title ?? <Skeleton className="h-7 w-64" />}
            </h1>
            {exam ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone={exam.status === 'ACTIVE' ? 'pass' : 'violet'}>{exam.status}</Badge>
                <span className="font-mono text-[11px] text-muted">
                  {formatDateTime(exam.scheduledStart)} → {formatDateTime(exam.scheduledEnd)}
                </span>
                <span className="font-mono text-[11px] text-faint">
                  {exam.durationMin} min · {exam.gracePeriodMin} min grace
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex gap-2">
            {exam && exam.status !== 'DRAFT' ? (
              <Button
                variant="ghost"
                onClick={() => void setPublished(false)}
                loading={publishing}
                title="Hide this exam from students again"
              >
                <EyeOff className="h-4 w-4" />
                Unpublish
              </Button>
            ) : null}
            <Button variant="outline" onClick={exportCsv} disabled={!results}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Link href={`/teacher/exams/${examId}/proctor`}>
              <Button variant="brass">
                <Radio className="h-4 w-4" />
                Live proctor
              </Button>
            </Link>
          </div>
        </header>

        {/*
          A draft is invisible to students however good the schedule looks, so
          say that plainly rather than leaving the badge to carry it.
        */}
        {exam?.status === 'DRAFT' ? (
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-panel border border-warn/30 bg-warn/[0.07] px-4 py-3.5">
            <EyeOff className="h-5 w-5 shrink-0 text-warn" strokeWidth={1.7} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-warn">This exam is a draft</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                Students cannot see it or start it, even once the scheduled window opens. Publish it
                when the paper is ready — you can unpublish again any time before anyone starts.
              </p>
            </div>
            <Button onClick={() => void setPublished(true)} loading={publishing}>
              <Eye className="h-4 w-4" />
              Publish exam
            </Button>
          </div>
        ) : null}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {results ? (
            <>
              <Stat
                icon={Users}
                value={`${results.summary.started}/${results.summary.enrolled}`}
                unit="started"
                note={`${results.summary.notStarted} absent`}
              />
              <Stat
                icon={Users}
                value={results.summary.submitted}
                unit="submitted"
                tone="trace"
              />
              <Stat
                icon={Users}
                value={`${results.summary.averageScore}/${results.exam.maxScore}`}
                unit="average score"
                tone="brass"
              />
              <Stat
                icon={ShieldAlert}
                value={results.summary.averageIntegrity}
                unit="average integrity"
                tone={results.summary.averageIntegrity >= 85 ? 'trace' : 'brass'}
              />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
          )}
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Panel className="overflow-hidden">
            <PanelHeader label="Results" title="Student attempts" />

            {results === null ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : results.attempts.length === 0 ? (
              <Empty
                icon={Users}
                title="Nobody has started yet"
                description="Attempts appear here the moment a student opens the exam."
              />
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[44rem]">
                  <thead>
                    <tr className="border-y border-line">
                      {['Student', 'Score', '%', 'Integrity', 'Violations', 'Time', 'Status'].map(
                        (heading, i) => (
                          <th
                            key={heading}
                            className={cn(
                              'instrument px-4 py-2 font-normal',
                              i === 0 ? 'text-left' : 'text-right',
                              i === 6 && 'text-right',
                            )}
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {results.attempts.map((attempt) => (
                      <tr
                        key={attempt.attemptId}
                        className="border-b border-line transition-colors last:border-b-0 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/teacher/exams/${examId}/proctor?attempt=${attempt.attemptId}`}
                            className="flex items-center gap-2.5"
                          >
                            <Avatar
                              name={attempt.user.displayName}
                              avatar={attempt.user.avatar}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-[13.5px] text-paper">
                                {attempt.user.displayName}
                              </div>
                              <div className="font-mono text-[10px] text-faint">
                                @{attempt.user.username}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-paper tabular">
                          {attempt.totalScore}/{attempt.maxScore}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-muted tabular">
                          {attempt.percentage}%
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-mono text-[12px] tabular',
                            integrityTone(attempt.integrityScore),
                          )}
                        >
                          {attempt.integrityScore}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-muted tabular">
                          {attempt.violationCount}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-muted tabular">
                          {attempt.timeTakenMin === null ? '—' : `${attempt.timeTakenMin}m`}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {attempt.flagged ? <Badge tone="fail">FLAGGED</Badge> : null}
                            <Badge tone={attempt.status === 'SUBMITTED' ? 'pass' : 'warn'}>
                              {attempt.autoSubmitted ? 'auto' : attempt.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {results.notStarted.map((row) => (
                      <tr key={row.user.id} className="border-b border-line opacity-50 last:border-b-0">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={row.user.displayName} avatar={row.user.avatar} size="sm" />
                            <div className="min-w-0">
                              <div className="truncate text-[13.5px] text-paper">
                                {row.user.displayName}
                              </div>
                              <div className="font-mono text-[10px] text-faint">
                                @{row.user.username}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td colSpan={5} />
                        <td className="px-4 py-2.5 text-right">
                          <Badge>not started</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel className="h-fit">
            <PanelHeader label="Paper" title="Questions" />
            <PanelBody className="pt-4">
              {exam?.problems ? (
                <ol className="space-y-2">
                  {exam.problems.map((entry, index) => (
                    <li key={entry.id} className="flex items-start gap-2.5">
                      <span className="mt-0.5 w-4 shrink-0 font-mono text-[11px] text-faint tabular">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-paper">
                          {entry.problem.title}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <DifficultyBadge value={entry.problem.difficulty} />
                          <span className="font-mono text-[10px] text-brass-lit">
                            {entry.points} pts
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <Skeleton className="h-24 w-full" />
              )}

              {exam ? (
                <div className="mt-4 space-y-1.5 border-t border-line pt-4">
                  {[
                    ['Question order', exam.status === 'DRAFT' ? '—' : 'shuffled per student'],
                    ['Grace period', `${exam.gracePeriodMin} min`],
                    ['Duration', `${exam.durationMin} min`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-2">
                      <span className="instrument">{label}</span>
                      <span className="font-mono text-[11px] text-muted">{value}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </PageTransition>
  );
}
