'use client';

import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Stat } from '@/components/ui/stat';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type {
  ClassOverview,
  ClassSummary,
  ClassroomInsights,
  ExamSummary,
  Paginated,
  SubmissionListRow,
} from '@/lib/types';
import { relativeTime } from '@/lib/utils';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [overviews, setOverviews] = useState<Record<string, ClassOverview>>({});
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [activity, setActivity] = useState<SubmissionListRow[] | null>(null);

  const [insights, setInsights] = useState<ClassroomInsights | null>(null);
  const [insightsBusy, setInsightsBusy] = useState(false);

  useEffect(() => {
    void api
      .get<ClassSummary[]>('/classes')
      .then(async (list) => {
        setClasses(list);
        const entries = await Promise.all(
          list.map(async (cls) => {
            try {
              return [cls.id, await api.get<ClassOverview>(`/analytics/class/${cls.id}`)] as const;
            } catch {
              return null;
            }
          }),
        );
        setOverviews(Object.fromEntries(entries.filter(Boolean) as [string, ClassOverview][]));
      })
      .catch(() => setClasses([]));

    void api.get<ExamSummary[]>('/exams').then(setExams).catch(() => setExams([]));
  }, []);

  // Recent activity across the first class the teacher owns.
  useEffect(() => {
    const first = classes?.[0];
    if (!first) return;
    void api
      .get<{ userId: string }[]>(`/classes/${first.id}/students`)
      .then(async (students) => {
        const rows = await Promise.all(
          students.slice(0, 8).map((student) =>
            api
              .get<Paginated<SubmissionListRow>>(`/submissions?limit=3&userId=${student.userId}`)
              .then((result) => result.data)
              .catch(() => []),
          ),
        );
        setActivity(
          rows
            .flat()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 8),
        );
      })
      .catch(() => setActivity([]));
  }, [classes]);

  async function loadInsights() {
    const first = classes?.[0];
    if (!first) return;
    setInsightsBusy(true);
    try {
      setInsights(
        await api.post<ClassroomInsights>('/analytics/classroom-insights', { classId: first.id }),
      );
    } catch {
      setInsights(null);
    } finally {
      setInsightsBusy(false);
    }
  }

  const totals = Object.values(overviews).reduce(
    (sum, overview) => ({
      students: sum.students + overview.students,
      submissions: sum.submissions + overview.totalSubmissions,
      passed: sum.passed + overview.passedSubmissions,
    }),
    { students: 0, submissions: 0, passed: 0 },
  );
  const passRate = totals.submissions === 0 ? 0 : Math.round((totals.passed / totals.submissions) * 100);
  const activeExams = (exams ?? []).filter((exam) => exam.status === 'ACTIVE');

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header>
          <span className="instrument">Teaching console</span>
          <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-white">
            {user?.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {activeExams.length > 0
              ? `${activeExams.length} exam${activeExams.length === 1 ? '' : 's'} running right now.`
              : 'Nothing is being examined right now.'}
          </p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {classes === null ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
          ) : (
            <>
              <Stat icon={Users} value={totals.students} unit="students" />
              <Stat icon={Activity} value={totals.submissions} unit="submissions" tone="brass" />
              <Stat icon={CheckCircle2} value={`${passRate}%`} unit="pass rate" tone="trace" />
              <Stat
                icon={BrainCircuit}
                value={activeExams.length}
                unit="exams running"
                note={`${exams?.length ?? 0} total`}
              />
            </>
          )}
        </section>

        <section className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="instrument">Classes</span>
            <Link href="/teacher/classes">
              <Button variant="ghost" size="sm">
                Manage
              </Button>
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classes === null ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
            ) : classes.length === 0 ? (
              <Panel className="sm:col-span-2 lg:col-span-3">
                <Empty
                  icon={Users}
                  title="No classes yet"
                  description="Create a class to enroll students, assign problems and schedule exams."
                  action={
                    <Link href="/teacher/classes">
                      <Button size="sm">Create a class</Button>
                    </Link>
                  }
                />
              </Panel>
            ) : (
              classes.map((cls) => {
                const overview = overviews[cls.id];
                const running = (exams ?? []).filter(
                  (exam) => exam.classId === cls.id && exam.status === 'ACTIVE',
                ).length;

                return (
                  <Link key={cls.id} href={`/teacher/classes/${cls.id}`}>
                    <Panel hover className="h-full p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[15px] font-medium text-paper">{cls.name}</h3>
                        <span className="font-mono text-[11px] text-brass-lit">{cls.code}</span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-lg leading-none font-semibold text-paper tabular">
                            {cls._count.enrollments}
                          </div>
                          <div className="instrument mt-1">students</div>
                        </div>
                        <div>
                          <div className="text-lg leading-none font-semibold text-paper tabular">
                            {overview ? `${overview.averageAccuracy}%` : '—'}
                          </div>
                          <div className="instrument mt-1">accuracy</div>
                        </div>
                        <div>
                          <div className="text-lg leading-none font-semibold text-paper tabular">
                            {running}
                          </div>
                          <div className="instrument mt-1">live exams</div>
                        </div>
                      </div>

                      {overview && overview.weakestCategories.length > 0 ? (
                        <div className="mt-3 border-t border-line pt-3">
                          <span className="instrument">Weakest</span>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {overview.weakestCategories.map((category) => (
                              <Badge key={category.category} tone="warn">
                                {category.category} {category.accuracy}%
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </Panel>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader label="Recent" title="Latest student submissions" />
            <PanelBody className="pt-3">
              {activity === null ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : activity.length === 0 ? (
                <Empty
                  icon={Activity}
                  title="No submissions yet"
                  description="Once your students start solving problems, their attempts show up here."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {activity.map((row) => (
                    <li key={row.id} className="flex items-center gap-3 py-2.5">
                      {row.passed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-trace" strokeWidth={1.8} />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-fault" strokeWidth={1.8} />
                      )}
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-paper">
                        {row.problem.title}
                      </span>
                      <span className="font-mono text-[11px] text-muted tabular">
                        {row.score}/{row.problem.points}
                      </span>
                      <span className="hidden font-mono text-[10px] text-faint sm:inline">
                        {relativeTime(row.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              label="Assistant"
              title="Classroom insights"
              action={
                <Button
                  variant="brass"
                  size="sm"
                  onClick={() => void loadInsights()}
                  loading={insightsBusy}
                  disabled={!classes || classes.length === 0}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {insights ? 'Refresh' : 'Generate'}
                </Button>
              }
            />
            <PanelBody className="pt-3">
              {insights?.insights ? (
                <>
                  <div className="prose-lab text-[13.5px]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{insights.insights}</ReactMarkdown>
                  </div>
                  <p className="mt-3 font-mono text-[10px] text-faint">
                    {insights.provider} · only aggregate numbers were sent, no names or code
                  </p>
                </>
              ) : insights && insights.error ? (
                <div className="rounded-lg border border-warn/30 bg-warn/[0.07] px-3 py-2.5 text-[13px] text-warn">
                  {insights.error}
                </div>
              ) : (
                <p className="text-[13px] text-muted">
                  Summarises where {classes?.[0]?.name ?? 'your class'} is doing well, where it is
                  stuck, and what to teach next. Runs on your local model — only aggregate statistics
                  leave the server.
                </p>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </PageTransition>
  );
}
