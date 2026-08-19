'use client';

import { Flame, Trophy, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Empty } from '@/components/ui/empty';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { api, query } from '@/lib/api';
import type { ClassSummary, LeaderboardRow } from '@/lib/types';
import { cn } from '@/lib/utils';

type Scope = 'class' | 'global';

/** Brass for the podium, muted for everyone else. */
function rankStyle(rank: number): string {
  if (rank === 1) return 'text-brass-lit';
  if (rank <= 3) return 'text-brass';
  return 'text-faint';
}

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>('class');
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    void api
      .get<ClassSummary[]>('/classes')
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    const classId = scope === 'class' ? classes[0]?.id : undefined;
    if (scope === 'class' && !classId) return;

    setRows(null);
    void api
      .get<LeaderboardRow[]>(`/gamification/leaderboard${query({ classId, limit: 50 })}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [scope, classes]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header>
          <span className="instrument">Standings</span>
          <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            Ranked by XP. Solving a problem for the first time is what moves you up.
          </p>
        </header>

        <Tabs
          className="mt-5"
          value={scope}
          onChange={setScope}
          items={[
            { value: 'class', label: classes[0]?.name ?? 'My class' },
            { value: 'global', label: 'Everyone' },
          ]}
        />

        <Panel className="mt-4 overflow-hidden">
          {!rows ? (
            <div className="space-y-px p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Empty
              icon={Users}
              title="No one on the board yet"
              description="Ranks appear once students start solving problems."
            />
          ) : (
            <>
              <div className="grid grid-cols-[3rem_1fr_4.5rem_4rem_3.5rem] items-center gap-3 border-b border-line px-4 py-2.5 sm:grid-cols-[3rem_1fr_5rem_5rem_4.5rem_4rem]">
                <span className="instrument">Rank</span>
                <span className="instrument">Student</span>
                <span className="instrument hidden text-right sm:block">Level</span>
                <span className="instrument text-right">Solved</span>
                <span className="instrument text-right">Streak</span>
                <span className="instrument text-right">XP</span>
              </div>

              <ul>
                {rows.map((row) => (
                  <li
                    key={row.userId}
                    className={cn(
                      'grid grid-cols-[3rem_1fr_4.5rem_4rem_3.5rem] items-center gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 sm:grid-cols-[3rem_1fr_5rem_5rem_4.5rem_4rem]',
                      row.isCurrentUser && 'bg-violet/[0.12]',
                    )}
                  >
                    <span
                      className={cn(
                        'font-mono text-[15px] font-semibold tabular',
                        rankStyle(row.rank),
                      )}
                    >
                      {row.rank === 1 ? (
                        <Trophy className="h-4 w-4 text-brass-lit" strokeWidth={1.8} />
                      ) : (
                        row.rank
                      )}
                    </span>

                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={row.displayName} avatar={row.avatar} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] text-paper">
                          {row.displayName}
                          {row.isCurrentUser ? (
                            <span className="ml-1.5 font-mono text-[10px] text-violet-lit">you</span>
                          ) : null}
                        </div>
                        <div className="font-mono text-[10px] text-faint">@{row.username}</div>
                      </div>
                    </div>

                    <span className="hidden text-right font-mono text-[12px] text-muted tabular sm:block">
                      L{row.level}
                    </span>
                    <span className="text-right font-mono text-[12px] text-muted tabular">
                      {row.problemsSolved}
                    </span>
                    <span className="flex items-center justify-end gap-1 font-mono text-[12px] text-muted tabular">
                      {row.currentStreak > 0 ? (
                        <Flame className="h-3 w-3 text-brass" strokeWidth={2} />
                      ) : null}
                      {row.currentStreak}
                    </span>
                    <span className="text-right font-mono text-[13px] font-medium text-brass-lit tabular">
                      {row.xp.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </PageTransition>
  );
}
