'use client';

import { Archive, GraduationCap, Maximize2, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { JoinCodeDisplay } from '@/components/class/join-code-display';
import { PageTransition } from '@/components/layout/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import type { ClassSummary } from '@/lib/types';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState<ClassSummary | null>(null);
  const [projecting, setProjecting] = useState<ClassSummary | null>(null);

  useEffect(() => {
    // Admins get every class from this endpoint; teachers only their own.
    // Archived ones are excluded by default, and an admin view should show them.
    void api
      .get<ClassSummary[]>('/classes?includeArchived=true')
      .then(setClasses)
      .catch(() => {
        toast.error('Could not load classes');
        setClasses([]);
      });
  }, []);

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return classes ?? [];
    return (classes ?? []).filter(
      (cls) =>
        cls.name.toLowerCase().includes(needle) ||
        cls.code.toLowerCase().includes(needle) ||
        cls.teacher.displayName.toLowerCase().includes(needle),
    );
  }, [classes, term]);

  const totalStudents = (classes ?? []).reduce((sum, cls) => sum + cls._count.enrollments, 0);

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">System</span>
            <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-white">
              Classes
            </h1>
            <p className="mt-1 text-sm text-muted">
              {classes === null
                ? 'Loading…'
                : `${classes.length} class${classes.length === 1 ? '' : 'es'} · ${totalStudents} enrolment${
                    totalStudents === 1 ? '' : 's'
                  }`}
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Name, code or teacher"
              aria-label="Search classes"
              className="w-full pl-9 sm:w-72"
            />
          </div>
        </header>

        <div className="mt-6">
          {classes === null ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Panel>
              <Empty
                icon={GraduationCap}
                title={term ? 'No classes match that search' : 'No classes yet'}
                description={
                  term
                    ? 'Try the class code or the teacher’s name.'
                    : 'Classes appear here once a teacher creates one.'
                }
              />
            </Panel>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((cls) => (
                <Panel key={cls.id} hover className="flex h-full flex-col p-4">
                  <button
                    onClick={() => setOpen(cls)}
                    className="min-w-0 text-left"
                    aria-label={`Open ${cls.name}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-[15px] font-medium text-paper">{cls.name}</h2>
                        {cls.semester ? (
                          <span className="font-mono text-[10px] text-faint">{cls.semester}</span>
                        ) : null}
                      </div>
                      {cls.isArchived ? <Badge>archived</Badge> : null}
                    </div>

                    <div className="mt-3 flex items-center gap-2.5">
                      <Avatar
                        name={cls.teacher.displayName}
                        avatar={cls.teacher.avatar}
                        size="sm"
                      />
                      <span className="truncate text-[12.5px] text-muted">
                        {cls.teacher.displayName}
                      </span>
                    </div>
                  </button>

                  <div className="mt-3 flex items-center gap-4 border-t border-line pt-3">
                    {[
                      { label: 'students', value: cls._count.enrollments },
                      { label: 'problems', value: cls._count.assignedProblems },
                      { label: 'exams', value: cls._count.exams },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <div className="font-mono text-[13px] text-paper tabular">{stat.value}</div>
                        <div className="instrument mt-0.5">{stat.label}</div>
                      </div>
                    ))}

                    {/* Straight to the projection surface, without opening the class first. */}
                    <button
                      onClick={() => setProjecting(cls)}
                      title="Show the join code full screen"
                      className="ml-auto flex items-center gap-1.5 rounded-md border border-brass/35 bg-brass/12 px-2 py-1 font-mono text-[11px] text-brass-lit transition-colors hover:border-brass/60"
                    >
                      {cls.code}
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        label="Class"
        title={open?.name ?? ''}
        description={open?.description ?? undefined}
        footer={
          <Button variant="ghost" onClick={() => setOpen(null)}>
            Close
          </Button>
        }
      >
        {open ? (
          <>
            <button
              onClick={() => setProjecting(open)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-brass/35 bg-brass/12 px-4 py-3 text-left transition-colors hover:border-brass/60"
            >
              <div>
                <span className="instrument">Join code</span>
                <div className="font-mono text-[22px] font-semibold tracking-[0.14em] text-brass-lit">
                  {open.code}
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <Maximize2 className="h-4 w-4" />
                Show full screen
              </span>
            </button>

            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
              {[
                ['students', String(open._count.enrollments)],
                ['problems', String(open._count.assignedProblems)],
                ['exams', String(open._count.exams)],
                ['created', formatDateTime(open.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dd className="font-mono text-[13px] text-paper">{value}</dd>
                  <dt className="instrument mt-1">{label}</dt>
                </div>
              ))}
            </dl>

            <div className="mt-5 border-t border-line pt-4">
              <span className="instrument">Teacher</span>
              <div className="mt-2 flex items-center gap-2.5">
                <Avatar name={open.teacher.displayName} avatar={open.teacher.avatar} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] text-paper">
                    {open.teacher.displayName}
                  </div>
                  <div className="font-mono text-[10px] text-faint">@{open.teacher.username}</div>
                </div>
              </div>
            </div>

            {open.isArchived ? (
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[13px] text-muted">
                <Archive className="h-4 w-4 shrink-0" />
                This class is archived — students can no longer join with its code.
              </div>
            ) : null}
          </>
        ) : null}
      </Modal>

      <JoinCodeDisplay
        open={projecting !== null}
        code={projecting?.code ?? ''}
        name={projecting?.name ?? ''}
        onClose={() => setProjecting(null)}
      />
    </PageTransition>
  );
}
