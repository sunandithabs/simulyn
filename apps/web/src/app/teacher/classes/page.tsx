'use client';

import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Field, Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import type { ClassSummary } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', semester: '' });

  function load() {
    void api
      .get<ClassSummary[]>('/classes')
      .then(setClasses)
      .catch(() => setClasses([]));
  }

  useEffect(load, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await api.post<ClassSummary>('/classes', {
        name: form.name,
        description: form.description || undefined,
        semester: form.semester || undefined,
      });
      toast.success(`Created ${created.name}`, { description: `Join code ${created.code}` });
      setOpen(false);
      setForm({ name: '', description: '', semester: '' });
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the class');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">Roster</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              Classes
            </h1>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New class
          </Button>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {classes === null ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
          ) : classes.length === 0 ? (
            <Panel className="sm:col-span-2">
              <Empty
                icon={Users}
                title="No classes yet"
                description="A class holds your students, the problems you assign them and the exams you schedule."
                action={<Button size="sm" onClick={() => setOpen(true)}>Create a class</Button>}
              />
            </Panel>
          ) : (
            classes.map((cls) => (
              <Link key={cls.id} href={`/teacher/classes/${cls.id}`}>
                <Panel hover className="h-full p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-medium text-paper">{cls.name}</h2>
                      {cls.semester ? (
                        <span className="font-mono text-[10px] text-faint">{cls.semester}</span>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-md border border-brass/35 bg-brass/12 px-2 py-0.5 font-mono text-[11px] text-brass-lit">
                      {cls.code}
                    </span>
                  </div>

                  {cls.description ? (
                    <p className="mt-2 line-clamp-2 text-[13px] text-muted">{cls.description}</p>
                  ) : null}

                  <div className="mt-3 flex items-center gap-4 border-t border-line pt-3">
                    {[
                      { label: 'students', value: cls._count.enrollments },
                      { label: 'problems', value: cls._count.assignedProblems },
                      { label: 'exams', value: cls._count.exams },
                    ].map((entry) => (
                      <div key={entry.label}>
                        <span className="font-mono text-[13px] text-paper tabular">
                          {entry.value}
                        </span>
                        <span className="instrument ml-1.5">{entry.label}</span>
                      </div>
                    ))}
                    <span className="ml-auto font-mono text-[10px] text-faint">
                      {formatDate(cls.createdAt)}
                    </span>
                  </div>
                </Panel>
              </Link>
            ))
          )}
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        label="New class"
        title="Create a class"
        description="A six-character join code is generated automatically."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button form="create-class" type="submit" loading={busy}>
              Create class
            </Button>
          </>
        }
      >
        <form id="create-class" className="space-y-4" onSubmit={create}>
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="CSE 2027 Batch B"
              required
              autoFocus
            />
          </Field>
          <Field label="Semester" hint="Optional.">
            <Input
              value={form.semester}
              onChange={(event) => setForm({ ...form, semester: event.target.value })}
              placeholder="Odd 2027"
            />
          </Field>
          <Field label="Description" hint="Optional. Shown to students on their dashboard.">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Algorithms and analog electronics lab."
            />
          </Field>
        </form>
      </Modal>
    </PageTransition>
  );
}
