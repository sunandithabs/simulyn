'use client';

import {
  ArrowLeft,
  BookPlus,
  CalendarClock,
  Check,
  Copy,
  Maximize2,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { JoinCodeDisplay } from '@/components/class/join-code-display';
import { PageTransition } from '@/components/layout/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge, DifficultyBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { api, query } from '@/lib/api';
import type {
  ClassProblemAssignment,
  ClassStudentProgress,
  ClassSummary,
  ExamSummary,
  Paginated,
  Problem,
  SubmissionListRow,
  UserStats,
} from '@/lib/types';
import { cn, formatDate, formatDateTime, relativeTime } from '@/lib/utils';

type Tab = 'students' | 'problems' | 'exams';

interface StudentHit {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar: string | null;
}

export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const classId = params.id;

  const [cls, setCls] = useState<ClassSummary | null>(null);
  const [students, setStudents] = useState<ClassStudentProgress[] | null>(null);
  const [assignments, setAssignments] = useState<ClassProblemAssignment[] | null>(null);
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [tab, setTab] = useState<Tab>('students');

  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [inspecting, setInspecting] = useState<ClassStudentProgress | null>(null);

  function loadStudents() {
    void api
      .get<ClassStudentProgress[]>(`/classes/${classId}/students`)
      .then(setStudents)
      .catch(() => setStudents([]));
  }

  function loadAssignments() {
    void api
      .get<ClassProblemAssignment[]>(`/classes/${classId}/problems`)
      .then(setAssignments)
      .catch(() => setAssignments([]));
  }

  useEffect(() => {
    void api.get<ClassSummary>(`/classes/${classId}`).then(setCls).catch(() => undefined);
    loadStudents();
    loadAssignments();
    void api
      .get<ExamSummary[]>('/exams')
      .then((all) => setExams(all.filter((exam) => exam.classId === classId)))
      .catch(() => setExams([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function removeStudent(userId: string, name: string) {
    try {
      await api.delete(`/classes/${classId}/students/${userId}`);
      toast.success(`Removed ${name} from the class`);
      loadStudents();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove that student');
    }
  }

  async function unassign(problemId: string, title: string) {
    try {
      await api.delete(`/classes/${classId}/problems/${problemId}`);
      toast.success(`Unassigned ${title}`);
      loadAssignments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not unassign that problem');
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/teacher/classes"
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-paper"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All classes
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">Class</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              {cls?.name ?? <Skeleton className="h-7 w-56" />}
            </h1>
            {cls?.description ? (
              <p className="mt-1 max-w-xl text-sm text-muted">{cls.description}</p>
            ) : null}
          </div>

          {cls ? (
            <div className="flex items-center gap-2">
              {/*
                Clicking the code puts it on screen for the room; copying is the
                secondary action, on its own control so neither is a surprise.
              */}
              <button
                onClick={() => setShowCode(true)}
                title="Show the join code full screen"
                className="flex items-center gap-2 rounded-lg border border-brass/35 bg-brass/12 px-3 py-2 transition-colors hover:border-brass/60"
              >
                <div className="text-left">
                  <span className="instrument">Join code</span>
                  <div className="font-mono text-[15px] font-semibold text-brass-lit">
                    {cls.code}
                  </div>
                </div>
                <Maximize2 className="h-4 w-4 text-brass-lit" />
              </button>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Copy join code"
                onClick={() => {
                  void navigator.clipboard.writeText(cls.code);
                  setCopied(true);
                  toast.success('Join code copied');
                  setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-trace" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : null}
        </header>

        <Tabs
          className="mt-6"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'students', label: 'Students', count: students?.length },
            { value: 'problems', label: 'Problems', count: assignments?.length },
            { value: 'exams', label: 'Exams', count: exams?.length },
          ]}
        />

        {tab === 'students' ? (
          <Panel className="mt-4 overflow-hidden">
            <PanelHeader
              label="Roster"
              title="Enrolled students"
              action={
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5" />
                  Add students
                </Button>
              }
            />

            {students === null ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <Empty
                icon={Users}
                title="Nobody enrolled yet"
                description="Share the join code, or add students directly."
                action={<Button size="sm" onClick={() => setAddOpen(true)}>Add students</Button>}
              />
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[42rem]">
                  <thead>
                    <tr className="border-y border-line">
                      {['Student', 'Solved', 'Submissions', 'Accuracy', 'XP', 'Joined', ''].map(
                        (heading, i) => (
                          <th
                            key={heading || i}
                            className={cn(
                              'instrument px-4 py-2 text-left font-normal',
                              i > 0 && i < 5 && 'text-right',
                            )}
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr
                        key={student.userId}
                        className="border-b border-line transition-colors last:border-b-0 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => setInspecting(student)}
                            className="flex w-full items-center gap-2.5 text-left"
                          >
                            <Avatar name={student.displayName} avatar={student.avatar} size="sm" />
                            <div className="min-w-0">
                              <div className="truncate text-[13.5px] text-paper">
                                {student.displayName}
                              </div>
                              <div className="font-mono text-[10px] text-faint">
                                @{student.username}
                              </div>
                            </div>
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-muted tabular">
                          {student.problemsSolved}/{student.assignedProblems}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-muted tabular">
                          {student.totalSubmissions}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2.5 text-right font-mono text-[12px] tabular',
                            student.accuracy >= 70
                              ? 'text-trace'
                              : student.accuracy >= 40
                                ? 'text-warn'
                                : 'text-muted',
                          )}
                        >
                          {student.totalSubmissions === 0 ? '—' : `${student.accuracy}%`}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] text-brass-lit tabular">
                          {student.xp.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-faint">
                          {formatDate(student.joinedAt)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${student.displayName}`}
                            onClick={() => void removeStudent(student.userId, student.displayName)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        ) : null}

        {tab === 'problems' ? (
          <Panel className="mt-4">
            <PanelHeader
              label="Coursework"
              title="Assigned problems"
              action={
                <Button size="sm" onClick={() => setAssignOpen(true)}>
                  <BookPlus className="h-3.5 w-3.5" />
                  Assign problem
                </Button>
              }
            />
            <PanelBody className="pt-4">
              {assignments === null ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : assignments.length === 0 ? (
                <Empty
                  icon={BookPlus}
                  title="No problems assigned"
                  description="Assign problems from the bank so they appear in your students' lists."
                  action={<Button size="sm" onClick={() => setAssignOpen(true)}>Assign a problem</Button>}
                />
              ) : (
                <ul className="divide-y divide-line">
                  {assignments.map((assignment) => (
                    <li key={assignment.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-paper">
                        {assignment.problem.title}
                      </span>
                      <DifficultyBadge value={assignment.problem.difficulty} />
                      <Badge>{assignment.problem.category}</Badge>
                      <span className="hidden font-mono text-[10px] text-faint sm:inline">
                        {assignment.dueDate ? `due ${formatDate(assignment.dueDate)}` : 'no due date'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Unassign ${assignment.problem.title}`}
                        onClick={() =>
                          void unassign(assignment.problem.id, assignment.problem.title)
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        ) : null}

        {tab === 'exams' ? (
          <Panel className="mt-4">
            <PanelHeader
              label="Assessment"
              title="Scheduled exams"
              action={
                <Link href="/teacher/exams/create">
                  <Button size="sm">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Schedule exam
                  </Button>
                </Link>
              }
            />
            <PanelBody className="pt-4">
              {exams === null ? (
                <Skeleton className="h-20 w-full" />
              ) : exams.length === 0 ? (
                <Empty
                  icon={CalendarClock}
                  title="No exams for this class"
                  description="Schedule one to open a timed, proctored window for these students."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {exams.map((exam) => (
                    <li key={exam.id}>
                      <Link
                        href={`/teacher/exams/${exam.id}`}
                        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-paper">
                          {exam.title}
                        </span>
                        <Badge tone={exam.status === 'ACTIVE' ? 'pass' : 'violet'}>
                          {exam.status}
                        </Badge>
                        <span className="hidden font-mono text-[10px] text-faint sm:inline">
                          {formatDateTime(exam.scheduledStart)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        ) : null}
      </div>

      <JoinCodeDisplay
        open={showCode && cls !== null}
        code={cls?.code ?? ''}
        name={cls?.name ?? ''}
        onClose={() => setShowCode(false)}
      />

      <AddStudentsModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        classId={classId}
        joinCode={cls?.code ?? ''}
        enrolled={new Set((students ?? []).map((student) => student.userId))}
        onDone={loadStudents}
      />

      <AssignProblemModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        classId={classId}
        assigned={new Set((assignments ?? []).map((assignment) => assignment.problem.id))}
        onDone={loadAssignments}
      />

      <StudentProgressModal student={inspecting} onClose={() => setInspecting(null)} />
    </PageTransition>
  );
}

/** Drill-down on one student: their standing, and what they last attempted. */
function StudentProgressModal({
  student,
  onClose,
}: {
  student: ClassStudentProgress | null;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recent, setRecent] = useState<SubmissionListRow[] | null>(null);

  useEffect(() => {
    if (!student) return;
    setStats(null);
    setRecent(null);
    void api
      .get<UserStats>(`/users/${student.userId}/stats`)
      .then(setStats)
      .catch(() => setStats(null));
    void api
      .get<Paginated<SubmissionListRow>>(`/submissions?limit=10&userId=${student.userId}`)
      .then((result) => setRecent(result.data))
      .catch(() => setRecent([]));
  }, [student]);

  return (
    <Modal
      open={student !== null}
      onClose={onClose}
      label="Student"
      title={student?.displayName ?? ''}
      description={student ? `@${student.username}` : undefined}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['solved', stats?.problemsSolved],
          ['submissions', stats?.totalSubmissions],
          ['accuracy', stats ? `${stats.accuracy}%` : undefined],
          ['xp', stats?.xp.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-line p-3">
            <dd className="text-[20px] leading-none font-semibold text-paper tabular">
              {value ?? '—'}
            </dd>
            <dt className="instrument mt-1.5">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-5">
        <span className="instrument">Recent submissions</span>
        <div className="hairline mt-1.5 w-10" />

        {recent === null ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">
            This student has not submitted anything yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {recent.map((row) => (
              <li key={row.id} className="flex items-center gap-2.5 py-2">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    row.passed ? 'bg-trace' : 'bg-fault',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-paper">
                  {row.problem.title}
                </span>
                <span className="font-mono text-[11px] text-muted tabular">
                  {row.score}/{row.problem.points}
                </span>
                <span className="font-mono text-[10px] text-faint">
                  {relativeTime(row.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function AddStudentsModal({
  open,
  onClose,
  classId,
  joinCode,
  enrolled,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  classId: string;
  joinCode: string;
  enrolled: Set<string>;
  onDone: () => void;
}) {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setHits([]);
      setPicked(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (term.trim().length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      void api
        .get<StudentHit[]>(`/users/lookup${query({ q: term })}`)
        .then(setHits)
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  async function enroll() {
    setBusy(true);
    try {
      const result = await api.post<{ enrolled: number; skipped: number }>(
        `/classes/${classId}/enroll`,
        { userIds: [...picked] },
      );
      toast.success(
        `Added ${result.enrolled} student${result.enrolled === 1 ? '' : 's'}`,
        result.skipped ? { description: `${result.skipped} were already enrolled` } : undefined,
      );
      onDone();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not enroll those students');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Enrollment"
      title="Add students"
      description="Search accounts that already exist, or share the join code and let them enroll themselves."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void enroll()} loading={busy} disabled={picked.size === 0}>
            Add {picked.size > 0 ? picked.size : ''} student{picked.size === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="rounded-lg border border-brass/30 bg-brass/[0.07] px-3 py-2.5">
        <span className="instrument">Self-enrollment</span>
        <p className="mt-1 text-[13px] text-muted">
          Students can join from their own account with the code{' '}
          <span className="font-mono text-brass-lit">{joinCode}</span>.
        </p>
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search by username, name or email"
          className="pl-9"
          autoFocus
        />
      </div>

      <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
        {term.trim().length < 2 ? (
          <p className="py-4 text-center text-[13px] text-faint">
            Type at least two characters to search.
          </p>
        ) : hits.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-faint">No students match that search.</p>
        ) : (
          hits.map((hit) => {
            const already = enrolled.has(hit.id);
            const selected = picked.has(hit.id);
            return (
              <button
                key={hit.id}
                disabled={already}
                onClick={() =>
                  setPicked((previous) => {
                    const next = new Set(previous);
                    if (next.has(hit.id)) next.delete(hit.id);
                    else next.add(hit.id);
                    return next;
                  })
                }
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                  already
                    ? 'cursor-not-allowed border-line opacity-45'
                    : selected
                      ? 'border-violet-lit/50 bg-violet/15'
                      : 'border-line hover:border-white/25',
                )}
              >
                <Avatar name={hit.displayName} avatar={hit.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] text-paper">{hit.displayName}</div>
                  <div className="truncate font-mono text-[10px] text-faint">
                    @{hit.username} · {hit.email}
                  </div>
                </div>
                {already ? (
                  <span className="font-mono text-[10px] text-faint">enrolled</span>
                ) : selected ? (
                  <Check className="h-4 w-4 text-violet-lit" />
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}

function AssignProblemModal({
  open,
  onClose,
  classId,
  assigned,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  classId: string;
  assigned: Set<string>;
  onDone: () => void;
}) {
  const [term, setTerm] = useState('');
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void api
      .get<Paginated<Problem>>(`/problems${query({ search: term, limit: 50, sortBy: 'title', order: 'asc' })}`)
      .then((result) => setProblems(result.data))
      .catch(() => setProblems([]));
  }, [open, term]);

  async function assign(problem: Problem) {
    setBusyId(problem.id);
    try {
      await api.post(`/classes/${classId}/problems`, {
        problemId: problem.id,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      toast.success(`Assigned ${problem.title}`);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not assign that problem');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Coursework"
      title="Assign a problem"
      description="Assigned problems appear in your students' problem list."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search the problem bank"
            className="pl-9"
            autoFocus
          />
        </div>
        <label className="block">
          <span className="instrument">Due date</span>
          <Input
            type="datetime-local"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mt-2 w-[13rem]"
          />
        </label>
      </div>

      <div className="mt-4 max-h-72 space-y-1 overflow-y-auto">
        {problems === null ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)
        ) : problems.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-faint">No problems match that search.</p>
        ) : (
          problems.map((problem) => {
            const already = assigned.has(problem.id);
            return (
              <div
                key={problem.id}
                className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] text-paper">{problem.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <DifficultyBadge value={problem.difficulty} />
                    <span className="font-mono text-[10px] text-faint">{problem.category}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={already ? 'ghost' : 'outline'}
                  disabled={already}
                  loading={busyId === problem.id}
                  onClick={() => void assign(problem)}
                >
                  {already ? 'Assigned' : 'Assign'}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
