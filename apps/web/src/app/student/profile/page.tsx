'use client';

import { CheckCircle2, Inbox, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge, DifficultyBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { LevelMeter } from '@/components/ui/meter';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { BadgeRow, GamificationMe, Paginated, SubmissionListRow, UserStats } from '@/lib/types';
import { cn, formatDate, formatDuration, relativeTime } from '@/lib/utils';

const PAGE_SIZE = 10;

export default function ProfilePage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<GamificationMe | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [badges, setBadges] = useState<BadgeRow[] | null>(null);
  const [history, setHistory] = useState<Paginated<SubmissionListRow> | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    void api.get<GamificationMe>('/gamification/me').then(setProgress).catch(() => undefined);
    void api.get<BadgeRow[]>('/gamification/badges').then(setBadges).catch(() => setBadges([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    void api.get<UserStats>(`/users/${user.id}/stats`).then(setStats).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    setHistory(null);
    void api
      .get<Paginated<SubmissionListRow>>(`/submissions?limit=${PAGE_SIZE}&page=${page}`)
      .then(setHistory)
      .catch(() => undefined);
  }, [page]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-start gap-5 p-6">
            <Avatar name={user?.displayName ?? '?'} avatar={user?.avatar} size="lg" />

            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.03em] text-white">
                {user?.displayName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] text-faint">@{user?.username}</span>
                <Badge tone="violet">{user?.role.toLowerCase()}</Badge>
                <span className="font-mono text-[11px] text-faint">{user?.email}</span>
              </div>
            </div>

            {progress ? (
              <LevelMeter
                xp={progress.xp}
                level={progress.level}
                thresholds={progress.levelThresholds}
                className="w-full sm:w-64"
              />
            ) : (
              <Skeleton className="h-10 w-56" />
            )}
          </div>

          <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
            {[
              { label: 'problems solved', value: stats?.problemsSolved },
              { label: 'submissions', value: stats?.totalSubmissions },
              { label: 'accuracy', value: stats ? `${stats.accuracy}%` : undefined },
              { label: 'longest streak', value: stats?.longestStreak },
            ].map((entry, index) => (
              <div
                key={entry.label}
                className={cn(
                  'px-5 py-4',
                  index < 3 && 'sm:border-r sm:border-line',
                  index < 2 && 'border-b border-line sm:border-b-0',
                  index % 2 === 0 && 'border-r border-line sm:border-r',
                )}
              >
                <dd className="text-[22px] leading-none font-semibold tracking-[-0.03em] text-paper tabular">
                  {entry.value ?? '—'}
                </dd>
                <dt className="instrument mt-1.5">{entry.label}</dt>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel className="mt-4">
          <PanelHeader
            label="Collection"
            title="Badges"
            action={
              badges ? (
                <span className="font-mono text-[11px] text-faint tabular">
                  {badges.filter((badge) => badge.earned).length}/{badges.length}
                </span>
              ) : null
            }
          />
          <PanelBody className="pt-4">
            {!badges ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {badges.map((badge) => (
                  <div
                    key={badge.key}
                    className={cn(
                      'rounded-lg border p-3 text-center transition-colors',
                      badge.earned
                        ? 'border-brass/35 bg-brass/[0.07]'
                        : 'border-line bg-white/[0.02]',
                    )}
                    title={badge.description}
                  >
                    <div className={cn('text-2xl', !badge.earned && 'opacity-25 grayscale')}>
                      {badge.icon}
                    </div>
                    <div
                      className={cn(
                        'mt-2 text-[12px] leading-tight font-medium',
                        badge.earned ? 'text-paper' : 'text-faint',
                      )}
                    >
                      {badge.name}
                    </div>
                    <div className="mt-1 font-mono text-[9px] text-faint">
                      {badge.earned ? formatDate(badge.earnedAt) : 'locked'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>

        <Panel className="mt-4">
          <PanelHeader label="History" title="All submissions" />
          <PanelBody className="pt-3">
            {!history ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : history.data.length === 0 ? (
              <Empty
                icon={Inbox}
                title="No submissions yet"
                description="Solve your first problem and it will be recorded here."
                action={
                  <Link href="/student/problems">
                    <Button size="sm">Browse problems</Button>
                  </Link>
                }
              />
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {history.data.map((row) => (
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
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-paper">
                          {row.problem.title}
                        </span>
                        <DifficultyBadge value={row.problem.difficulty} />
                        <span className="hidden font-mono text-[10px] text-faint sm:inline">
                          {row.language.toLowerCase()}
                        </span>
                        <span className="w-14 text-right font-mono text-[11px] text-muted tabular">
                          {row.score}/{row.problem.points}
                        </span>
                        <span className="hidden w-16 text-right font-mono text-[10px] text-faint tabular md:inline">
                          {formatDuration(row.executionMs)}
                        </span>
                        <span className="hidden w-20 text-right font-mono text-[10px] text-faint sm:inline">
                          {relativeTime(row.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>

                {history.meta.totalPages > 1 ? (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-faint tabular">
                      Page {history.meta.page} of {history.meta.totalPages} · {history.meta.total}{' '}
                      total
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((value) => value - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= history.meta.totalPages}
                        onClick={() => setPage((value) => value + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </PanelBody>
        </Panel>
      </div>
    </PageTransition>
  );
}
