'use client';

import {
  CalendarClock,
  CheckCircle2,
  Flame,
  Inbox,
  Trophy,
  UserPlus,
  XCircle,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ActivityHeatmap } from '@/components/charts/activity-heatmap';
import { SkillRadar, toSkillData } from '@/components/charts/skill-radar';
import { JoinClassDialog } from '@/components/class/join-class-dialog';
import { PageTransition } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Stat } from '@/components/ui/stat';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { ExamSummary, GamificationMe, Paginated, SubmissionListRow } from '@/lib/types';
import { formatClock, relativeTime } from '@/lib/utils';

/** One line, chosen from where the student actually is right now. */
function greeting(progress: GamificationMe | null): string {
  if (!progress) return 'Loading your bench…';
  if (progress.problemsSolved === 0) return 'Your bench is set up. Pick a problem to get started.';
  if (progress.currentStreak >= 7)
    return `${progress.currentStreak} days running. That habit is doing the work for you.`;
  if (progress.currentStreak >= 2) return `Day ${progress.currentStreak} of your streak — keep it going.`;
  if (progress.xpToNextLevel !== null && progress.xpToNextLevel <= 200)
    return `${progress.xpToNextLevel} XP from level ${progress.level + 1}. One solve away.`;
  return 'Pick up where you left off.';
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<GamificationMe | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionListRow[] | null>(null);
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    void api.get<GamificationMe>('/gamification/me').then(setProgress).catch(() => setProgress(null));
    // 100 is the API's per-page ceiling — enough to fill the 13-week heatmap.
    void api
      .get<Paginated<SubmissionListRow>>('/submissions?limit=100&sortBy=createdAt&order=desc')
      .then((result) => setSubmissions(result.data))
      .catch(() => setSubmissions([]));
    void api
      .get<ExamSummary[]>('/exams')
      .then(setExams)
      .catch(() => setExams([]));
  }, []);

  const upcoming = (exams ?? [])
    .filter((exam) => exam.status === 'SCHEDULED' || exam.status === 'ACTIVE')
    .slice(0, 3);

  const recent = (submissions ?? []).slice(0, 5);

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <span className="instrument">Bench · {user?.username}</span>
            <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-white">
              {user?.displayName.split(' ')[0]}
            </h1>
            <p className="mt-1 text-sm text-muted">{greeting(progress)}</p>
          </div>

          <Button variant="outline" onClick={() => setJoinOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Join a class
          </Button>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {progress ? (
            <>
              <Stat
                icon={CheckCircle2}
                value={progress.problemsSolved}
                unit="problems solved"
                tone="trace"
              />
              <Stat
                icon={Flame}
                value={progress.currentStreak}
                unit="day streak"
                note={`best ${progress.longestStreak}`}
                tone="brass"
              />
              <Stat
                icon={Zap}
                value={progress.xp.toLocaleString()}
                unit={`xp · level ${progress.level}`}
              />
              <Stat icon={Trophy} value={`#${progress.rank}`} unit="global rank" tone="brass" />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass p-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="mt-3 h-7 w-16" />
                <Skeleton className="mt-2 h-3 w-20" />
              </div>
            ))
          )}
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader
              label="Activity"
              title="Submissions over the last 13 weeks"
            />
            <PanelBody className="pt-4">
              {submissions ? (
                <ActivityHeatmap dates={submissions.map((row) => row.createdAt)} />
              ) : (
                <Skeleton className="h-28 w-full" />
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader label="Profile" title="Accuracy by category" />
            <PanelBody className="pt-2">
              {submissions ? (
                <SkillRadar data={toSkillData(submissions)} />
              ) : (
                <Skeleton className="mx-auto h-56 w-56 rounded-full" />
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader
              label="Recent"
              title="Latest submissions"
              action={
                <Link href="/student/profile">
                  <Button variant="ghost" size="sm">
                    View all
                  </Button>
                </Link>
              }
            />
            <PanelBody className="pt-3">
              {!submissions ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <Empty
                  icon={Inbox}
                  title="Nothing submitted yet"
                  description="Your submissions and their test results will appear here."
                  action={
                    <Link href="/student/problems">
                      <Button size="sm">Browse problems</Button>
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-line">
                  {recent.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/student/problems/${row.problemId}`}
                        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
                      >
                        {row.passed ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-trace" strokeWidth={1.8} />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-fault" strokeWidth={1.8} />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] text-paper">{row.problem.title}</div>
                          <div className="font-mono text-[10px] text-faint">
                            {row.problem.category} · attempt {row.attemptNumber}
                          </div>
                        </div>
                        <span className="font-mono text-[11px] text-muted tabular">
                          {row.score}/{row.problem.points}
                        </span>
                        <span className="hidden font-mono text-[10px] text-faint sm:inline">
                          {relativeTime(row.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader label="Scheduled" title="Upcoming exams" />
            <PanelBody className="pt-3">
              {!exams ? (
                <Skeleton className="h-20 w-full" />
              ) : upcoming.length === 0 ? (
                <Empty
                  icon={CalendarClock}
                  title="No exams scheduled"
                  description="When your instructor schedules one, it will show up here with a countdown."
                />
              ) : (
                <ul className="space-y-2.5">
                  {upcoming.map((exam) => (
                    <li key={exam.id}>
                      <Link
                        href={`/student/exams/${exam.id}`}
                        className="block rounded-lg border border-line p-3 transition-colors hover:border-violet-lit/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[13.5px] font-medium text-paper">{exam.title}</span>
                          <Badge tone={exam.status === 'ACTIVE' ? 'pass' : 'violet'}>
                            {exam.status}
                          </Badge>
                        </div>
                        <div className="mt-1.5 font-mono text-[10px] text-faint">
                          {exam.durationMin} min ·{' '}
                          {new Date(exam.scheduledStart).toLocaleString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        {exam.status === 'ACTIVE' && exam.attempt ? (
                          <div className="mt-1 font-mono text-[10px] text-brass-lit">
                            {formatClock(
                              (new Date(exam.attempt.endsAt).getTime() - Date.now()) / 1000,
                            )}{' '}
                            remaining
                          </div>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>

        <JoinClassDialog
          open={joinOpen}
          onClose={() => setJoinOpen(false)}
          // A new class brings its own exams and assigned problems with it.
          onJoined={() => {
            void api.get<ExamSummary[]>('/exams').then(setExams).catch(() => undefined);
          }}
        />
      </div>
    </PageTransition>
  );
}
