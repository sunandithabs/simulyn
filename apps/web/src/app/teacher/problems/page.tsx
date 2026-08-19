'use client';

import { CircuitBoard, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge, DifficultyBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input, Select } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { api, query } from '@/lib/api';
import type { Paginated, Problem, ProblemType } from '@/lib/types';

export default function TeacherProblemsPage() {
  const { user } = useAuth();
  const [type, setType] = useState<ProblemType>('PROGRAMMING');
  const [difficulty, setDifficulty] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [problems, setProblems] = useState<Problem[] | null>(null);

  function load() {
    setProblems(null);
    void api
      .get<Paginated<Problem>>(
        `/problems${query({ type, difficulty, category, search, limit: 100, sortBy: 'title', order: 'asc' })}`,
      )
      .then((result) => setProblems(result.data))
      .catch(() => setProblems([]));
  }

  useEffect(load, [type, difficulty, category, search]);

  const categories = useMemo(
    () => [...new Set((problems ?? []).map((problem) => problem.category))].sort(),
    [problems],
  );

  async function remove(problem: Problem) {
    if (!window.confirm(`Delete "${problem.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/problems/${problem.id}`);
      toast.success(`Deleted ${problem.title}`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete that problem');
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">Bank</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              Problems
            </h1>
          </div>
          <Link href="/teacher/problems/create">
            <Button>
              <Plus className="h-4 w-4" />
              New problem
            </Button>
          </Link>
        </header>

        <Tabs
          className="mt-5"
          value={type}
          onChange={(value) => {
            setType(value);
            setCategory('');
          }}
          items={[
            { value: 'PROGRAMMING', label: 'Programming' },
            { value: 'ELECTRONICS', label: 'Electronics' },
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
          <div className="relative ml-auto w-full sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title"
              className="h-9 pl-9"
            />
          </div>
        </div>

        <Panel className="mt-4 overflow-hidden">
          {problems === null ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : problems.length === 0 ? (
            <Empty
              icon={CircuitBoard}
              title="No problems match those filters"
              description="Clear the filters, or author a new problem for this bank."
              action={
                <Link href="/teacher/problems/create">
                  <Button size="sm">New problem</Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {problems.map((problem) => {
                const mine = problem.createdById === user?.id || user?.role === 'ADMIN';
                return (
                  <li key={problem.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] text-paper">{problem.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <DifficultyBadge value={problem.difficulty} />
                        <Badge>{problem.category}</Badge>
                        {!problem.isPublished ? <Badge tone="warn">draft</Badge> : null}
                        <span className="font-mono text-[10px] text-brass-lit">
                          {problem.points} pts
                        </span>
                      </div>
                    </div>

                    <span className="hidden font-mono text-[10px] text-faint md:inline">
                      {problem.type === 'PROGRAMMING'
                        ? `${problem.testCases?.length ?? 0} cases`
                        : `${problem.questions?.length ?? 0} questions`}
                    </span>

                    {mine ? (
                      <>
                        <Link href={`/teacher/problems/create?edit=${problem.id}`}>
                          <Button variant="ghost" size="icon" aria-label={`Edit ${problem.title}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${problem.title}`}
                          onClick={() => void remove(problem)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <span className="font-mono text-[10px] text-faint">read only</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </PageTransition>
  );
}
