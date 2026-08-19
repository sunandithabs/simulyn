'use client';

import { CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { ExamSummary } from '@/lib/types';
import { formatClock, formatDateTime } from '@/lib/utils';

const TONE = {
  ACTIVE: 'pass',
  SCHEDULED: 'violet',
  COMPLETED: 'neutral',
  DRAFT: 'neutral',
} as const;

export default function StudentExamsPage() {
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    void api
      .get<ExamSummary[]>('/exams')
      .then(setExams)
      .catch(() => setExams([]));
  }, []);

  // Keep the countdowns honest.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header>
          <span className="instrument">Assessment</span>
          <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
            Exams
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every exam your classes have scheduled, with the window you can sit it in.
          </p>
        </header>

        <div className="mt-6 space-y-2.5">
          {!exams ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : exams.length === 0 ? (
            <Panel>
              <Empty
                icon={CalendarClock}
                title="No exams scheduled"
                description="When your instructor publishes one, it will appear here with its start time and duration."
              />
            </Panel>
          ) : (
            exams.map((exam) => {
              const start = new Date(exam.scheduledStart).getTime();
              const untilStart = (start - Date.now()) / 1000;

              return (
                <Link key={exam.id} href={`/student/exams/${exam.id}`} className="block">
                  <Panel hover className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[15px] font-medium text-paper">{exam.title}</h2>
                        <Badge tone={TONE[exam.status]}>{exam.status}</Badge>
                        {exam.attempt?.submittedAt ? <Badge tone="pass">submitted</Badge> : null}
                      </div>
                      <div className="mt-1.5 font-mono text-[11px] text-faint">
                        {exam.class.name} · {exam._count.problems} problems · {exam.durationMin} min
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-[11px] text-muted">
                        {formatDateTime(exam.scheduledStart)}
                      </div>
                      {exam.status === 'SCHEDULED' && untilStart > 0 ? (
                        <div className="mt-0.5 font-mono text-[11px] text-brass-lit tabular">
                          opens in {formatClock(untilStart)}
                        </div>
                      ) : null}
                      {exam.status === 'ACTIVE' && exam.attempt && !exam.attempt.submittedAt ? (
                        <div className="mt-0.5 font-mono text-[11px] text-warn tabular">
                          {formatClock(
                            (new Date(exam.attempt.endsAt).getTime() - Date.now()) / 1000,
                          )}{' '}
                          left
                        </div>
                      ) : null}
                      {exam.attempt?.submittedAt ? (
                        <div className="mt-0.5 font-mono text-[11px] text-muted tabular">
                          scored {exam.attempt.totalScore} · integrity{' '}
                          {exam.attempt.integrityScore}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  </Panel>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </PageTransition>
  );
}
