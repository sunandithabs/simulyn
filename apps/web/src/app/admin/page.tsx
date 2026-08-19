'use client';

import {
  Activity,
  BookOpen,
  CalendarClock,
  GraduationCap,
  HeartPulse,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Stat } from '@/components/ui/stat';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { SystemHealth, SystemOverview } from '@/lib/types';
import { cn, formatBytes, formatUptime } from '@/lib/utils';

export default function AdminHome() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    const load = () => {
      void api.get<SystemOverview>('/admin/overview').then(setOverview).catch(() => undefined);
      void api.get<SystemHealth>('/admin/health').then(setHealth).catch(() => undefined);
    };
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);

  const runtimes = health ? Object.entries(health.execution.languages) : [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">System</span>
            <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-white">
              {user?.displayName}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/users?new=1">
              <Button size="sm">
                <UserPlus className="h-3.5 w-3.5" />
                Create user
              </Button>
            </Link>
            <Link href="/admin/users?import=1">
              <Button variant="outline" size="sm">
                <Upload className="h-3.5 w-3.5" />
                Bulk import
              </Button>
            </Link>
            <Link href="/admin/settings">
              <Button variant="outline" size="sm">
                <HeartPulse className="h-3.5 w-3.5" />
                System health
              </Button>
            </Link>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {overview ? (
            <>
              <Stat
                icon={Users}
                value={overview.users.total}
                unit="accounts"
                note={`${overview.users.inactive} inactive`}
              />
              <Stat icon={GraduationCap} value={overview.classes} unit="classes" tone="brass" />
              <Stat
                icon={BookOpen}
                value={overview.problems.total}
                unit="problems"
                note={`${overview.problems.published} published`}
                tone="trace"
              />
              <Stat icon={Activity} value={overview.submissions} unit="submissions" />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
          )}
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader label="Accounts" title="Who is on the platform" />
            <PanelBody className="pt-4">
              {overview ? (
                <ul className="space-y-2.5">
                  {[
                    ['Students', overview.users.students],
                    ['Teachers', overview.users.teachers],
                    ['Admins', overview.users.admins],
                    ['Deactivated', overview.users.inactive],
                  ].map(([label, value]) => (
                    <li key={label as string} className="flex items-center gap-3">
                      <span className="w-24 text-[13px] text-muted">{label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-violet"
                          style={{
                            width: `${overview.users.total === 0 ? 0 : ((value as number) / overview.users.total) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-[12px] text-paper tabular">
                        {value}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Skeleton className="h-28 w-full" />
              )}

              <Link href="/admin/users">
                <Button variant="outline" size="sm" className="mt-4 w-full">
                  Manage users
                </Button>
              </Link>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              label="Live"
              title="System health"
              action={
                health ? (
                  <span className="font-mono text-[11px] text-faint">
                    up {formatUptime(health.uptimeSeconds)}
                  </span>
                ) : null
              }
            />
            <PanelBody className="pt-4">
              {health ? (
                <>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {[
                      ['database', `${health.database.provider} · ${formatBytes(health.database.sizeBytes)}`],
                      ['memory', formatBytes(health.memory.rssBytes)],
                      ['sockets', `${health.websockets.connected} connected`],
                      [
                        'executor',
                        `${health.execution.concurrency.free}/${health.execution.concurrency.capacity} free`,
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-2">
                        <dt className="instrument">{label}</dt>
                        <dd className="font-mono text-[12px] text-paper tabular">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 border-t border-line pt-3">
                    <span className="instrument">Language runtimes</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {runtimes.map(([lang, ok]) => (
                        <Badge key={lang} tone={ok ? 'pass' : 'fail'}>
                          {lang}
                        </Badge>
                      ))}
                    </div>
                    {runtimes.some(([, ok]) => !ok) ? (
                      <p className="mt-2 text-[12.5px] text-muted">
                        Submissions in a missing language return a toolchain error instead of
                        running. Install the compiler on the host, or use the Docker image which
                        ships all four.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <Skeleton className="h-32 w-full" />
              )}
            </PanelBody>
          </Panel>
        </div>

        <Panel className="mt-4">
          <PanelHeader label="Assessment" title="Exams" />
          <PanelBody className="pt-4">
            {overview ? (
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <div className="text-[22px] leading-none font-semibold text-paper tabular">
                    {overview.exams.total}
                  </div>
                  <div className="instrument mt-1">scheduled overall</div>
                </div>
                <div>
                  <div
                    className={cn(
                      'text-[22px] leading-none font-semibold tabular',
                      overview.exams.active > 0 ? 'text-trace' : 'text-paper',
                    )}
                  >
                    {overview.exams.active}
                  </div>
                  <div className="instrument mt-1">running now</div>
                </div>
                <div>
                  <div className="text-[22px] leading-none font-semibold text-paper tabular">
                    {overview.attemptsInProgress}
                  </div>
                  <div className="instrument mt-1">attempts open</div>
                </div>
                {overview.exams.active > 0 ? (
                  <div className="ml-auto flex items-center gap-2 rounded-lg border border-trace/30 bg-trace/[0.06] px-3 py-2">
                    <CalendarClock className="h-4 w-4 text-trace" strokeWidth={1.8} />
                    <span className="text-[13px] text-trace">An exam is in progress</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <Skeleton className="h-16 w-full" />
            )}
          </PanelBody>
        </Panel>
      </div>
    </PageTransition>
  );
}
