'use client';

import { Activity, AlertTriangle, BarChart3, CheckCircle2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Select } from '@/components/ui/input';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Stat } from '@/components/ui/stat';
import { api } from '@/lib/api';
import type { AnalyticsStudentRow, ClassOverview, ClassSummary } from '@/lib/types';
import { cn, relativeTime } from '@/lib/utils';

/** Accuracy read as a colour: the same bands used on the class roster. */
function accuracyTone(value: number): string {
  if (value >= 70) return 'text-trace';
  if (value >= 40) return 'text-warn';
  return 'text-fault';
}

export default function TeacherAnalyticsPage() {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [classId, setClassId] = useState('');
  const [overview, setOverview] = useState<ClassOverview | null>(null);
  const [students, setStudents] = useState<AnalyticsStudentRow[] | null>(null);

  useEffect(() => {
    void api
      .get<ClassSummary[]>('/classes')
      .then((list) => {
        setClasses(list);
        if (list[0]) setClassId(list[0].id);
      })
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (!classId) return;
    setOverview(null);
    setStudents(null);
    void api
      .get<ClassOverview>(`/analytics/class/${classId}`)
      .then(setOverview)
      .catch(() => setOverview(null));
    void api
      .get<AnalyticsStudentRow[]>(`/analytics/class/${classId}/students`)
      .then(setStudents)
      .catch(() => setStudents([]));
  }, [classId]);

  const maxAttempts = Math.max(1, ...(overview?.categories ?? []).map((c) => c.attempts));

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">Measurement</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              Analytics
            </h1>
          </div>

          {classes && classes.length > 0 ? (
            <Select
              className="h-10"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              aria-label="Class"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </Select>
          ) : null}
        </header>

        {classes !== null && classes.length === 0 ? (
          <Panel className="mt-6">
            <Empty
              icon={Users}
              title="No classes to measure yet"
              description="Create a class and assign problems — the numbers appear as students work."
            />
          </Panel>
        ) : null}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {overview ? (
            <>
              <Stat icon={Users} value={overview.students} unit="students" />
              <Stat
                icon={Activity}
                value={overview.activeStudents}
                unit="active this week"
                note={`of ${overview.students}`}
                tone="brass"
              />
              <Stat
                icon={CheckCircle2}
                value={`${overview.averageAccuracy}%`}
                unit="pass rate"
                note={`${overview.totalSubmissions} submissions`}
                tone="trace"
              />
              <Stat
                icon={BarChart3}
                value={overview.problemsSolved}
                unit="problems solved"
                note={`${overview.assignedProblems} assigned`}
              />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
          )}
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Panel className="overflow-hidden">
            <PanelHeader label="Per student" title="Where everyone stands" />

            {students === null ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <Empty
                icon={Users}
                title="Nobody enrolled"
                description="Add students to this class to see their progress here."
              />
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[44rem]">
                  <thead>
                    <tr className="border-y border-line">
                      {['Student', 'Solved', 'Attempts', 'Accuracy', 'Avg score', 'Flags', 'Last seen'].map(
                        (heading, i) => (
                          <th
                            key={heading}
                            className={cn(
                              'instrument px-4 py-2 font-normal',
                              i === 0 ? 'text-left' : 'text-right',
                            )}
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((row) => (
                      <tr
                        key={row.user.id}
                        className="border-b border-line transition-colors last:border-b-0 hover:bg-white/[0.02]"
                      >
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
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-muted tabular">
                          {row.problemsSolved}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-muted tabular">
                          {row.totalSubmissions}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-mono text-[12px] tabular',
                            row.totalSubmissions === 0 ? 'text-faint' : accuracyTone(row.accuracy),
                          )}
                        >
                          {row.totalSubmissions === 0 ? '—' : `${row.accuracy}%`}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-muted tabular">
                          {row.averageScore}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {row.violations > 0 ? (
                            <span className="font-mono text-[12px] text-fault tabular">
                              {row.violations}
                            </span>
                          ) : (
                            <span className="font-mono text-[12px] text-faint">0</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[10px] text-faint">
                          {row.lastSubmissionAt ? relativeTime(row.lastSubmissionAt) : 'never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="space-y-4">
            <Panel>
              <PanelHeader label="By topic" title="Accuracy per category" />
              <PanelBody className="pt-4">
                {!overview ? (
                  <Skeleton className="h-32 w-full" />
                ) : overview.categories.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-faint">
                    No submissions yet, so there is nothing to break down.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {overview.categories.map((category) => (
                      <li key={category.category}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] text-paper">
                            {category.category}
                          </span>
                          <span
                            className={cn(
                              'font-mono text-[11px] tabular',
                              accuracyTone(category.accuracy),
                            )}
                          >
                            {category.accuracy}%
                          </span>
                        </div>
                        {/* Bar length is attempt volume; colour is accuracy. */}
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              category.accuracy >= 70
                                ? 'bg-trace'
                                : category.accuracy >= 40
                                  ? 'bg-warn'
                                  : 'bg-fault',
                            )}
                            style={{ width: `${(category.attempts / maxAttempts) * 100}%` }}
                          />
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-faint">
                          {category.passed}/{category.attempts} attempts passed
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>

            {overview && overview.weakestCategories.length > 0 ? (
              <Panel>
                <PanelHeader label="Attention" title="Weakest topics" />
                <PanelBody className="pt-3">
                  <ul className="space-y-2">
                    {overview.weakestCategories.map((category) => (
                      <li
                        key={category.category}
                        className="flex items-center gap-2 rounded-lg border border-warn/25 bg-warn/[0.06] px-3 py-2"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn" strokeWidth={1.8} />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-paper">
                          {category.category}
                        </span>
                        <Badge tone="warn">{category.accuracy}%</Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[12.5px] text-muted">
                    Ranked by pass rate across at least two attempts. Worth a recap before the next
                    assessment.
                  </p>
                </PanelBody>
              </Panel>
            ) : null}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
