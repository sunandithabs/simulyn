'use client';

import { CalendarClock, Plus, Radio } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import type { ExamSummary } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

const TONE = {
  ACTIVE: 'pass',
  SCHEDULED: 'violet',
  COMPLETED: 'neutral',
  DRAFT: 'warn',
} as const;

type Filter = 'all' | 'ACTIVE' | 'SCHEDULED' | 'COMPLETED' | 'DRAFT';

export default function TeacherExamsPage() {
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    void api
      .get<ExamSummary[]>('/exams')
      .then(setExams)
      .catch(() => setExams([]));
  }, []);

  const visible = (exams ?? []).filter((exam) => filter === 'all' || exam.status === filter);
  const countOf = (status: Filter) =>
    status === 'all' ? exams?.length : exams?.filter((exam) => exam.status === status).length;

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">Assessment</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              Exams
            </h1>
          </div>
          <Link href="/teacher/exams/create">
            <Button>
              <Plus className="h-4 w-4" />
              Schedule exam
            </Button>
          </Link>
        </header>

        <Tabs
          className="mt-5"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'All', count: countOf('all') },
            { value: 'ACTIVE', label: 'Active', count: countOf('ACTIVE') },
            { value: 'SCHEDULED', label: 'Scheduled', count: countOf('SCHEDULED') },
            { value: 'COMPLETED', label: 'Completed', count: countOf('COMPLETED') },
            { value: 'DRAFT', label: 'Draft', count: countOf('DRAFT') },
          ]}
        />

        <div className="mt-4 space-y-2.5">
          {exams === null ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : visible.length === 0 ? (
            <Panel>
              <Empty
                icon={CalendarClock}
                title={filter === 'all' ? 'No exams yet' : `No ${filter.toLowerCase()} exams`}
                description="Schedule an exam to open a timed, proctored window for a class."
                action={
                  <Link href="/teacher/exams/create">
                    <Button size="sm">Schedule an exam</Button>
                  </Link>
                }
              />
            </Panel>
          ) : (
            visible.map((exam) => (
              <Panel key={exam.id} hover className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link href={`/teacher/exams/${exam.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[15px] font-medium text-paper">{exam.title}</h2>
                      <Badge tone={TONE[exam.status]}>{exam.status}</Badge>
                    </div>
                    <div className="mt-1.5 font-mono text-[11px] text-faint">
                      {exam.class.name} · {exam._count.problems} problems · {exam.durationMin} min ·{' '}
                      {exam._count.attempts} attempt{exam._count.attempts === 1 ? '' : 's'}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted">
                      {formatDateTime(exam.scheduledStart)} → {formatDateTime(exam.scheduledEnd)}
                    </div>
                  </Link>

                  <div className="flex shrink-0 gap-2">
                    {exam.status === 'ACTIVE' ? (
                      <Link href={`/teacher/exams/${exam.id}/proctor`}>
                        <Button variant="brass" size="sm">
                          <Radio className="h-3.5 w-3.5" />
                          Proctor
                        </Button>
                      </Link>
                    ) : null}
                    <Link href={`/teacher/exams/${exam.id}`}>
                      <Button variant="outline" size="sm">
                        Open
                      </Button>
                    </Link>
                  </div>
                </div>
              </Panel>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}
