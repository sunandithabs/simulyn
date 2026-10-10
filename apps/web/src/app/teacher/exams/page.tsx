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
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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

        {exams === null ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <Panel className="mt-4">
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
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((exam) => (
              <Panel key={exam.id} hover className="flex h-full flex-col p-4">
                <Link href={`/teacher/exams/${exam.id}`} className="block min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 text-[15px] leading-snug font-medium text-paper">{exam.title}</h2>
                    <Badge tone={TONE[exam.status]}>{exam.status}</Badge>
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-brass-lit">{exam.class.name}</div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-lg leading-none font-semibold text-paper tabular">{exam._count.problems}</div>
                      <div className="instrument mt-1">problems</div>
                    </div>
                    <div>
                      <div className="text-lg leading-none font-semibold text-paper tabular">{exam.durationMin}</div>
                      <div className="instrument mt-1">minutes</div>
                    </div>
                    <div>
                      <div className="text-lg leading-none font-semibold text-paper tabular">{exam._count.attempts}</div>
                      <div className="instrument mt-1">attempts</div>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-line pt-3 font-mono text-[11px] text-muted">
                    {formatDateTime(exam.scheduledStart)} → {formatDateTime(exam.scheduledEnd)}
                  </div>
                </Link>
                <div className="mt-3 flex gap-2">
                  {exam.status === 'ACTIVE' ? (
                    <Link href={`/teacher/exams/${exam.id}/proctor`} className="flex-1">
                      <Button variant="brass" size="sm" className="w-full justify-center">
                        <Radio className="h-3.5 w-3.5" />
                        Proctor
                      </Button>
                    </Link>
                  ) : null}
                  <Link href={`/teacher/exams/${exam.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full justify-center">
                      Open
                    </Button>
                  </Link>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
