'use client';

import { Megaphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Field, Input, Select } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import type { ClassSummary } from '@/lib/types';

interface Row { id: string; title: string; body: string; createdAt: string }

export default function TeacherAnnouncementsPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classId, setClassId] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void api.get<ClassSummary[]>('/classes').then((l) => {
      setClasses(l);
      if (l[0]) setClassId(l[0].id);
    }).catch(() => setClasses([])).finally(() => setLoaded(true));
  }, []);

  const load = useCallback(() => {
    if (!classId) return;
    setRows(null);
    void api.get<Row[]>(`/classes/${classId}/announcements`).then(setRows).catch(() => setRows([]));
  }, [classId]);
  useEffect(load, [load]);

  async function post() {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/classes/${classId}/announcements`, { title, body });
      setTitle('');
      setBody('');
      toast.success('Announcement sent');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not post');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
        <header>
          <span className="instrument">Class</span>
          <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">Announcements</h1>
        </header>
        <Panel>
          <PanelHeader label="Class" title="Post an announcement" />
          <div className="space-y-4 p-5">
            {loaded && classes.length === 0 ? (
              <p className="text-sm text-muted">You have no classes yet — create one to post announcements.</p>
            ) : null}
            <Select aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Field label="Title">
              <Input maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Message" hint="Students are notified in-app, and by email if email is configured.">
              <Textarea rows={4} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <Button loading={busy} disabled={busy || !classId || !title.trim() || !body.trim()} onClick={post}>
              Send to class
            </Button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader label="History" title="Previous announcements" />
          {rows === null ? (
            <div className="p-5"><Skeleton className="h-24" /></div>
          ) : rows.length === 0 ? (
            <Empty icon={Megaphone} title="No announcements" description="Messages you send to this class will be listed here." />
          ) : (
            <ul className="divide-y divide-line px-5 pb-3 text-sm">
              {rows.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="text-paper">{r.title}</div>
                  <div className="mt-0.5 whitespace-pre-wrap text-muted">{r.body}</div>
                  <div className="mt-1 text-[10px] text-faint">{new Date(r.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageTransition>
  );
}
