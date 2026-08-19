'use client';

import { ArrowLeft, GripVertical, Plus, Save, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { DifficultyBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, query } from '@/lib/api';
import type { ClassSummary, ExamSummary, Paginated, Problem } from '@/lib/types';

/** datetime-local wants a local ISO string without the timezone suffix. */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

interface Selected {
  problem: Problem;
  points: number | '';
}

export default function CreateExamPage() {
  const router = useRouter();

  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMin, setDurationMin] = useState(90);
  const [gracePeriodMin, setGracePeriodMin] = useState(5);
  const [randomizeOrder, setRandomizeOrder] = useState(true);
  const [isPublished, setIsPublished] = useState(false);

  const now = new Date();
  const [start, setStart] = useState(toLocalInput(new Date(now.getTime() + 15 * 60_000)));
  const [end, setEnd] = useState(toLocalInput(new Date(now.getTime() + 3 * 3600_000)));

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Problem[] | null>(null);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

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
    void api
      .get<Paginated<Problem>>(
        `/problems${query({ search: term, limit: 30, isPublished: true, sortBy: 'title', order: 'asc' })}`,
      )
      .then((result) => setResults(result.data))
      .catch(() => setResults([]));
  }, [term]);

  function move(from: number, to: number) {
    if (to < 0 || to >= selected.length) return;
    setSelected((rows) => {
      const next = [...rows];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  const totalPoints = selected.reduce(
    (sum, row) => sum + (row.points === '' ? row.problem.points : Number(row.points)),
    0,
  );

  async function save() {
    if (selected.length === 0) {
      toast.error('Add at least one problem to the exam');
      return;
    }
    setBusy(true);
    try {
      const exam = await api.post<ExamSummary>('/exams', {
        classId,
        title,
        description: description || undefined,
        durationMin,
        gracePeriodMin,
        randomizeOrder,
        isPublished,
        scheduledStart: new Date(start).toISOString(),
        scheduledEnd: new Date(end).toISOString(),
        problems: selected.map((row) => ({
          problemId: row.problem.id,
          ...(row.points === '' ? {} : { points: Number(row.points) }),
        })),
      });
      toast.success(isPublished ? 'Exam published' : 'Exam saved as a draft');
      router.push(`/teacher/exams/${exam.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the exam');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          href="/teacher/exams"
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-paper"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All exams
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">Schedule</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              New exam
            </h1>
          </div>
          <Button onClick={() => void save()} loading={busy} disabled={!title || !classId}>
            <Save className="h-4 w-4" />
            {isPublished ? 'Publish exam' : 'Save draft'}
          </Button>
        </header>

        <div className="mt-6 space-y-4">
          <Panel>
            <PanelHeader label="Setup" title="When and for whom" />
            <PanelBody className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title">
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Mid-semester practical"
                  />
                </Field>
                <Field label="Class">
                  {classes === null ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      className="h-10 w-full"
                      value={classId}
                      onChange={(event) => setClassId(event.target.value)}
                    >
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} ({cls._count.enrollments} students)
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>

              <Field label="Description" hint="Optional. Shown before the student starts.">
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Opens">
                  <Input
                    type="datetime-local"
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                  />
                </Field>
                <Field label="Closes">
                  <Input
                    type="datetime-local"
                    value={end}
                    onChange={(event) => setEnd(event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Duration" hint="Minutes each student gets once they start.">
                  <Input
                    type="number"
                    min={1}
                    value={durationMin}
                    onChange={(event) => setDurationMin(Number(event.target.value))}
                  />
                </Field>
                <Field label="Grace period" hint="Extra minutes past the close time.">
                  <Input
                    type="number"
                    min={0}
                    value={gracePeriodMin}
                    onChange={(event) => setGracePeriodMin(Number(event.target.value))}
                  />
                </Field>
              </div>

              <div className="border-t border-line pt-4">
                <span className="instrument">Options</span>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Switch
                    variant="card"
                    checked={randomizeOrder}
                    onChange={setRandomizeOrder}
                    label="Shuffle question order per student"
                    hint="Each student gets their own order, stored on their attempt."
                  />
                  <Switch
                    variant="card"
                    checked={isPublished}
                    onChange={setIsPublished}
                    label="Published"
                    hint="Only published exams appear in the students' exam list."
                  />
                </div>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              label="Paper"
              title="Questions"
              action={
                <span className="font-mono text-[11px] text-brass-lit tabular">
                  {selected.length} · {totalPoints} pts
                </span>
              }
            />
            <PanelBody className="pt-4">
              {selected.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-faint">
                  No questions yet. Search the bank below and add a few.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selected.map((row, index) => (
                    <li
                      key={row.problem.id}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null) move(dragIndex, index);
                        setDragIndex(null);
                      }}
                      className="flex items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3 py-2"
                    >
                      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-faint" />
                      <span className="w-5 shrink-0 font-mono text-[12px] text-faint tabular">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] text-paper">{row.problem.title}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <DifficultyBadge value={row.problem.difficulty} />
                          <span className="font-mono text-[10px] text-faint">
                            {row.problem.category}
                          </span>
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={row.points}
                        placeholder={String(row.problem.points)}
                        aria-label={`Points for ${row.problem.title}`}
                        className="h-8 w-20 font-mono text-[12px]"
                        onChange={(event) =>
                          setSelected((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    points:
                                      event.target.value === '' ? '' : Number(event.target.value),
                                  }
                                : r,
                            ),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${row.problem.title}`}
                        onClick={() => setSelected((rows) => rows.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 border-t border-line pt-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
                  <Input
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Search published problems"
                    className="pl-9"
                  />
                </div>

                <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                  {results === null ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))
                  ) : results.length === 0 ? (
                    <p className="py-4 text-center text-[13px] text-faint">
                      No published problems match that search.
                    </p>
                  ) : (
                    results.map((problem) => {
                      const already = selected.some((row) => row.problem.id === problem.id);
                      return (
                        <div
                          key={problem.id}
                          className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] text-paper">{problem.title}</div>
                            <span className="font-mono text-[10px] text-faint">
                              {problem.category} · {problem.points} pts
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant={already ? 'ghost' : 'outline'}
                            disabled={already}
                            onClick={() =>
                              setSelected((rows) => [...rows, { problem, points: '' }])
                            }
                          >
                            {already ? 'Added' : <Plus className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </PageTransition>
  );
}
