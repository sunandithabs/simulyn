'use client';

import {
  Activity,
  BookOpenCheck,
  CheckCircle2,
  FileClock,
  Megaphone,
  Rocket,
  ShieldAlert,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ActivityHeatmap } from '@/components/charts/activity-heatmap';
import { PageTransition } from '@/components/layout/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Stat } from '@/components/ui/stat';
import { api } from '@/lib/api';
import type { TeacherCategoryStat, TeacherProfile } from '@/lib/types';
import { formatDate, relativeTime } from '@/lib/utils';

function CategoryList({ rows, tone }: { rows: TeacherCategoryStat[]; tone: 'warn' | 'pass' }) {
  if (rows.length === 0) return <p className="text-[13px] text-faint">Not enough submissions yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((c) => (
        <li key={c.category} className="flex items-center justify-between gap-3 text-[13px]">
          <span className="truncate text-paper">{c.category}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-[11px] text-faint">{c.attempts} tries</span>
            <Badge tone={tone}>{c.accuracy}%</Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function TeacherProfilePage() {
  const [data, setData] = useState<TeacherProfile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get<TeacherProfile>('/analytics/teacher/me')
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Panel>
          <Empty icon={Activity} title="Could not load your profile" description="Refresh the page to try again." />
        </Panel>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const { user, exams, hackathons } = data;

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-start gap-5 p-6">
            <Avatar name={user.displayName} avatar={user.avatar} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.03em] text-white">
                {user.displayName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] text-faint">@{user.username}</span>
                <Badge tone="violet">{user.role}</Badge>
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted">
                {user.email} · joined {formatDate(user.createdAt)}
                {user.lastLoginAt ? ` · last sign-in ${relativeTime(user.lastLoginAt)}` : ''}
              </p>
            </div>
            <Link href="/change-password">
              <Button variant="outline" size="sm">
                Change password
              </Button>
            </Link>
          </div>
        </Panel>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={Users}
            value={data.students.total}
            unit="students"
            note={`${data.students.activeLast7Days} active (7d)`}
          />
          <Stat
            icon={Activity}
            tone="brass"
            value={data.submissions.last91Days}
            unit="submissions (13 wk)"
            note={data.submissions.passRate === null ? undefined : `${data.submissions.passRate}% pass`}
          />
          <Stat
            icon={BookOpenCheck}
            tone="trace"
            value={data.content.problemsAuthored}
            unit="problems authored"
            note={`${data.content.problemsPublished} published`}
          />
          <Stat icon={Megaphone} value={data.content.announcements} unit="announcements" />
          <Stat
            icon={FileClock}
            value={exams.total}
            unit="exams"
            note={`${exams.byStatus.ACTIVE} live · ${exams.byStatus.SCHEDULED} upcoming`}
          />
          <Stat icon={CheckCircle2} tone="trace" value={exams.attempts} unit="exam attempts" />
          <Stat
            icon={ShieldAlert}
            tone="brass"
            value={exams.flagged}
            unit="flagged attempts"
            note={exams.averageIntegrity === null ? undefined : `integrity ${exams.averageIntegrity}`}
          />
          <Stat
            icon={Rocket}
            value={hackathons.total}
            unit="hackathons hosted"
            note={`${hackathons.teams} teams · ${hackathons.byStatus.LIVE} live`}
          />
        </section>

        <Panel>
          <PanelHeader label="Activity" title="Student submissions, last 13 weeks" />
          <PanelBody className="overflow-x-auto pt-3">
            <ActivityHeatmap dates={data.activityDates} />
          </PanelBody>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader label="Teach next" title="Weakest topics" />
            <PanelBody className="pt-3">
              <CategoryList rows={data.weakestCategories} tone="warn" />
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader label="Going well" title="Strongest topics" />
            <PanelBody className="pt-3">
              <CategoryList rows={data.strongestCategories} tone="pass" />
            </PanelBody>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader label="Classes" title={`${data.classes.length} taught`} />
            <PanelBody className="pt-3">
              {data.classes.length === 0 ? (
                <p className="text-[13px] text-faint">No classes yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.classes.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/teacher/classes/${c.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 text-[13.5px] hover:text-paper"
                      >
                        <span className="min-w-0 truncate text-paper">{c.name}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          {c.isArchived ? <Badge tone="neutral">archived</Badge> : null}
                          <span className="font-mono text-[11px] text-brass-lit">{c.code}</span>
                          <span className="font-mono text-[11px] text-faint">{c.students} students</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader label="Recent" title="Latest student submissions" />
            <PanelBody className="pt-3">
              {data.recentSubmissions.length === 0 ? (
                <p className="text-[13px] text-faint">No submissions yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentSubmissions.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 py-2.5">
                      {r.passed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-trace" strokeWidth={1.8} />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-fault" strokeWidth={1.8} />
                      )}
                      <span className="min-w-0 flex-1 truncate text-[13px] text-paper">
                        {r.user.displayName} · {r.problem.title}
                      </span>
                      <span className="font-mono text-[10px] text-faint">{relativeTime(r.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </PageTransition>
  );
}
