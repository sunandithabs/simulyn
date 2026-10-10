'use client';

import { FileText, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Select } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { ClassSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Report {
  class: { name: string; code: string };
  generatedAt: string;
  classAccuracy: number;
  students: {
    user: { id: string; username: string; displayName: string };
    submissions: number;
    accuracy: number;
    problemsSolved: number;
    weakTopics: { category: string; accuracy: number }[];
    currentStreak: number;
    longestStreak: number;
  }[];
}

const tone = (v: number) => (v >= 70 ? 'text-trace' : v >= 40 ? 'text-warn' : 'text-fault');

export default function TeacherReportsPage() {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [roster, setRoster] = useState<Report['students']>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void api.get<ClassSummary[]>('/classes').then((l) => {
      setClasses(l);
      if (l[0]) setClassId(l[0].id);
    }).catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    const q = studentId ? `?studentId=${studentId}` : '';
    void api.get<Report>(`/analytics/class/${classId}/report${q}`).then((r) => {
      setReport(r);
      if (!studentId) setRoster(r.students);
    }).catch(() => setReport(null)).finally(() => setLoading(false));
  }, [classId, studentId]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6 print:max-w-none print:p-0">
        <header className="print:hidden">
          <span className="instrument">Insights</span>
          <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">Progress reports</h1>
        </header>

        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Select value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(''); setRoster([]); }}>
            {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Whole class</option>
            {roster.map((s) => <option key={s.user.id} value={s.user.id}>{s.user.displayName}</option>)}
          </Select>
          <Button variant="outline" size="sm" className="ml-auto" disabled={!report} onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print report
          </Button>
        </div>

        {classes === null || loading ? (
          <Skeleton className="h-64 w-full" />
        ) : !report ? (
          <Panel>
            <Empty icon={FileText} title="No report yet" description="Create a class and enrol students to generate progress reports." />
          </Panel>
        ) : (
          <Panel className="print:border-0 print:bg-white print:text-black print:shadow-none">
            <PanelHeader
              label="Progress report"
              title={`${report.class.name} (${report.class.code})`}
              action={<span className="text-xs text-muted">{new Date(report.generatedAt).toLocaleString()} · class accuracy {report.classAccuracy}%</span>}
            />
            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-faint">
                  <tr className="border-b border-line">
                    <th className="py-2">Student</th><th>Accuracy</th><th>Solved</th><th>Streak (best)</th><th>Weak topics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.students.map((s) => (
                    <tr key={s.user.id} className="align-top">
                      <td className="py-2 text-paper">{s.user.displayName}<div className="font-mono text-[10px] text-faint">@{s.user.username}</div></td>
                      <td className={cn('font-mono tabular', tone(s.accuracy))}>{s.accuracy}% <span className="text-faint">({s.submissions})</span></td>
                      <td className="font-mono tabular text-paper">{s.problemsSolved}</td>
                      <td className="font-mono tabular text-paper">{s.currentStreak} <span className="text-faint">({s.longestStreak})</span></td>
                      <td className="text-muted">{s.weakTopics.length ? s.weakTopics.map((t) => `${t.category} ${t.accuracy}%`).join(', ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.students.length === 0 ? <p className="py-6 text-center text-sm text-muted">No students enrolled.</p> : null}
            </div>
          </Panel>
        )}
      </div>
    </PageTransition>
  );
}
