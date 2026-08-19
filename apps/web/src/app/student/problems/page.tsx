'use client';

import { CheckCircle2, CircuitBoard, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge, DifficultyBadge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Input, Select } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { api, query } from '@/lib/api';
import type { Paginated, Problem, ProblemType, SubmissionListRow } from '@/lib/types';

type Status = 'all' | 'solved' | 'attempted' | 'unsolved';

export default function ProblemsPage() {
  const [type, setType] = useState<ProblemType>('PROGRAMMING');
  const [difficulty, setDifficulty] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [search, setSearch] = useState('');

  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [counts, setCounts] = useState<{ PROGRAMMING: number; ELECTRONICS: number }>({
    PROGRAMMING: 0,
    ELECTRONICS: 0,
  });
  const [attempts, setAttempts] = useState<Map<string, boolean>>(new Map());

  // Attempt history drives the solved/attempted filter.
  useEffect(() => {
    void api
      .get<Paginated<SubmissionListRow>>('/submissions?limit=100')
      .then((result) => {
        const map = new Map<string, boolean>();
        for (const row of result.data) {
          map.set(row.problemId, (map.get(row.problemId) ?? false) || row.passed);
        }
        setAttempts(map);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    setProblems(null);
    void api
      .get<Paginated<Problem>>(
        `/problems${query({ type, difficulty, category, search, limit: 100, sortBy: 'title', order: 'asc' })}`,
      )
      .then((result) => {
        if (!alive) return;
        setProblems(result.data);
        setCounts((previous) => ({ ...previous, [type]: result.meta.total }));
      })
      .catch(() => alive && setProblems([]));
    return () => {
      alive = false;
    };
  }, [type, difficulty, category, search]);

  // Counts for the other tab, so both tabs show a number immediately.
  useEffect(() => {
    void api
      .get<Paginated<Problem>>('/problems?limit=1&type=ELECTRONICS')
      .then((r) => setCounts((p) => ({ ...p, ELECTRONICS: r.meta.total })))
      .catch(() => undefined);
    void api
      .get<Paginated<Problem>>('/problems?limit=1&type=PROGRAMMING')
      .then((r) => setCounts((p) => ({ ...p, PROGRAMMING: r.meta.total })))
      .catch(() => undefined);
  }, []);

  const categories = useMemo(
    () => [...new Set((problems ?? []).map((problem) => problem.category))].sort(),
    [problems],
  );

  const visible = (problems ?? []).filter((problem) => {
    if (status === 'all') return true;
    const solved = attempts.get(problem.id);
    if (status === 'solved') return solved === true;
    if (status === 'attempted') return solved === false;
    return solved === undefined;
  });

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">Problem bank</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              Problems
            </h1>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title"
              className="pl-9"
            />
          </div>
        </header>

        <Tabs
          className="mt-5"
          value={type}
          onChange={(value) => {
            setType(value);
            setCategory('');
          }}
          items={[
            { value: 'PROGRAMMING', label: 'Programming', count: counts.PROGRAMMING },
            { value: 'ELECTRONICS', label: 'Electronics', count: counts.ELECTRONICS },
          ]}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-faint" />
          <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="">Any difficulty</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </Select>
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Any category</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value as Status)}>
            <option value="all">Any status</option>
            <option value="solved">Solved</option>
            <option value="attempted">Attempted</option>
            <option value="unsolved">Not started</option>
          </Select>
          <span className="ml-auto font-mono text-[11px] text-faint tabular">
            {visible.length} shown
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {!problems
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass p-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-3 h-3 w-24" />
                </div>
              ))
            : visible.map((problem) => {
                const solved = attempts.get(problem.id);
                return (
                  <Link key={problem.id} href={`/student/problems/${problem.id}`}>
                    <Panel hover className="h-full p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-[15px] leading-snug font-medium text-paper">
                          {problem.title}
                        </h2>
                        {solved === true ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-trace" strokeWidth={1.8} />
                        ) : solved === false ? (
                          <span
                            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-warn"
                            title="Attempted"
                          />
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <DifficultyBadge value={problem.difficulty} />
                        <Badge>{problem.category}</Badge>
                        <span className="ml-auto font-mono text-[11px] text-brass-lit tabular">
                          {problem.points} pts
                        </span>
                      </div>
                    </Panel>
                  </Link>
                );
              })}
        </div>

        {problems && visible.length === 0 ? (
          <Panel className="mt-4">
            <Empty
              icon={CircuitBoard}
              title="No problems match those filters"
              description="Try a different difficulty or category, or clear the search."
            />
          </Panel>
        ) : null}
      </div>
    </PageTransition>
  );
}
