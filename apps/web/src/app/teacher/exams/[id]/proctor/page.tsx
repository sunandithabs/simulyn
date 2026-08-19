'use client';

import {
  ArrowLeft,
  Bell,
  BellOff,
  Flag,
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Modal } from '@/components/ui/modal';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { createProctoringSocket, type Socket } from '@/lib/socket';
import type {
  LiveAttemptRow,
  ProctorNote,
  RecordedViolation,
  StudentFlaggedEvent,
  StudentReadmittedEvent,
  StudentTerminatedEvent,
  ViolationRow,
} from '@/lib/types';
import { cn, formatClock, relativeTime } from '@/lib/utils';

/** A student is idle when their heartbeat has been quiet for this long. */
const IDLE_AFTER_MS = 20_000;

interface StudentState {
  attemptId: string;
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  integrityScore: number;
  violationCount: number;
  /** Set by the server once the attempt passes the violation threshold. */
  flagged: boolean;
  /** Removed from the exam, by the threshold or by a proctor. */
  terminated: boolean;
  terminatedReason: string | null;
  terminatedBy: string | null;
  currentQuestion: number | null;
  timeRemaining: number | null;
  lastSeen: number | null;
  submitted: boolean;
  online: boolean;
}

type Status = 'active' | 'idle' | 'flagged' | 'offline' | 'submitted' | 'removed';

function statusOf(student: StudentState, now: number): Status {
  // Removal is terminal — it outranks every other state.
  if (student.terminated) return 'removed';
  if (student.flagged) return 'flagged';
  if (student.submitted) return 'submitted';
  if (student.violationCount >= 4 || student.integrityScore < 60) return 'flagged';
  if (!student.online) return 'offline';
  if (student.lastSeen !== null && now - student.lastSeen > IDLE_AFTER_MS) return 'idle';
  return 'active';
}

const STATUS_STYLE: Record<Status, { dot: string; label: string }> = {
  active: { dot: 'bg-trace', label: 'active' },
  idle: { dot: 'bg-warn', label: 'idle' },
  flagged: { dot: 'bg-fault', label: 'flagged' },
  offline: { dot: 'bg-faint', label: 'offline' },
  submitted: { dot: 'bg-violet-lit', label: 'submitted' },
  removed: { dot: 'bg-fault', label: 'removed' },
};

function violationTone(count: number): string {
  if (count === 0) return 'text-trace';
  if (count <= 3) return 'text-warn';
  return 'text-fault';
}

export default function ProctorPage() {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-96 w-full" /></div>}>
      <ProctorBoard />
    </Suspense>
  );
}

function ProctorBoard() {
  const examId = useParams<{ id: string }>().id;
  const focusAttempt = useSearchParams().get('attempt');

  const [students, setStudents] = useState<Map<string, StudentState>>(new Map());
  const [feed, setFeed] = useState<RecordedViolation[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audio, setAudio] = useState(false);
  const [openAttempt, setOpenAttempt] = useState<string | null>(focusAttempt);
  const [now, setNow] = useState(Date.now());

  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef(false);
  audioRef.current = audio;

  /** Short two-tone beep, synthesised so there is no asset to ship. */
  const beep = useCallback(() => {
    if (!audioRef.current) return;
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => void ctx.close(), 500);
    } catch {
      // Audio is a nicety; never let it break the board.
    }
  }, []);

  const upsert = useCallback((attemptId: string, patch: Partial<StudentState>) => {
    setStudents((previous) => {
      const next = new Map(previous);
      const existing = next.get(attemptId);
      if (!existing) return previous;
      next.set(attemptId, { ...existing, ...patch });
      return next;
    });
  }, []);

  // Seed the grid from the REST snapshot, then keep it live over the socket.
  useEffect(() => {
    void api
      .get<LiveAttemptRow[]>(`/proctoring/exams/${examId}/live`)
      .then((rows) => {
        setStudents(
          new Map(
            rows.map((row) => [
              row.attemptId,
              {
                attemptId: row.attemptId,
                userId: row.user.id,
                username: row.user.username,
                displayName: row.user.displayName,
                avatar: row.user.avatar,
                integrityScore: row.integrityScore,
                violationCount: row.violationCount,
                flagged: row.flagged,
                terminated: row.terminated,
                terminatedReason: row.terminatedReason,
                terminatedBy: row.terminatedBy,
                currentQuestion: null,
                timeRemaining: null,
                lastSeen: null,
                submitted: row.submittedAt !== null,
                online: false,
              },
            ]),
          ),
        );
      })
      .catch(() => toast.error('Could not load the attempt list'))
      .finally(() => setLoading(false));
  }, [examId]);

  useEffect(() => {
    const socket = createProctoringSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-exam', { examId }, (ack: { ok: boolean; error?: string }) => {
        if (!ack?.ok) toast.error(ack?.error ?? 'Could not join the proctoring room');
      });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('unauthorized', () => toast.error('Proctoring rejected this session'));

    socket.on(
      'student-joined',
      (event: { attemptId: string | null; userId: string; displayName: string }) => {
        if (!event.attemptId) return;
        upsert(event.attemptId, { online: true, lastSeen: Date.now() });
      },
    );

    socket.on(
      'student-heartbeat',
      (event: {
        attemptId: string;
        currentQuestion: number | null;
        timeRemaining: number | null;
        integrityScore: number;
        submitted: boolean;
      }) => {
        upsert(event.attemptId, {
          currentQuestion: event.currentQuestion,
          timeRemaining: event.timeRemaining,
          integrityScore: event.integrityScore,
          submitted: event.submitted,
          online: true,
          lastSeen: Date.now(),
        });
      },
    );

    socket.on('student-violation', (event: RecordedViolation) => {
      setFeed((previous) => [event, ...previous].slice(0, 60));
      upsert(event.examAttemptId, {
        integrityScore: event.integrityScore,
        violationCount: event.violationCount,
        online: true,
        lastSeen: Date.now(),
      });
      if (event.critical) beep();
    });

    // Raised once, when an attempt crosses the violation threshold.
    socket.on('student-flagged', (event: StudentFlaggedEvent) => {
      upsert(event.attemptId, {
        flagged: true,
        violationCount: event.violationCount,
        integrityScore: event.integrityScore,
      });
      beep();
      toast.error(`${event.displayName} has been flagged`, {
        description: `${event.violationCount} violations · integrity ${event.integrityScore}`,
        duration: 10_000,
      });
    });

    socket.on('student-terminated', (event: StudentTerminatedEvent) => {
      upsert(event.attemptId, {
        terminated: true,
        terminatedReason: event.reason,
        terminatedBy: event.by,
        flagged: true,
        submitted: true,
        violationCount: event.violationCount,
        integrityScore: event.integrityScore,
      });
      beep();
      toast.error(`${event.displayName} was removed from the exam`, {
        description: event.reason,
        duration: 12_000,
      });
    });

    socket.on('student-readmitted', (event: StudentReadmittedEvent) => {
      upsert(event.attemptId, {
        terminated: false,
        terminatedReason: null,
        terminatedBy: null,
        flagged: false,
        submitted: false,
      });
      toast.success(`${event.displayName} was readmitted to the exam`);
    });

    socket.on('student-disconnected', (event: { attemptId?: string }) => {
      if (event.attemptId) upsert(event.attemptId, { online: false });
    });

    socket.on('exam-ended', (event: { attemptId?: string }) => {
      if (event.attemptId) upsert(event.attemptId, { submitted: true });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [examId, upsert, beep]);

  // Drives the idle detector and the countdown labels.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const rows = useMemo(() => [...students.values()], [students]);
  const totals = useMemo(() => {
    const active = rows.filter((row) => statusOf(row, now) === 'active').length;
    const violations = rows.reduce((sum, row) => sum + row.violationCount, 0);
    const integrity =
      rows.length === 0
        ? 100
        : Math.round(rows.reduce((sum, row) => sum + row.integrityScore, 0) / rows.length);
    return { active, violations, integrity };
  }, [rows, now]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link
          href={`/teacher/exams/${examId}`}
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-paper"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Exam overview
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">Live proctoring</span>
            <h1 className="mt-2 flex items-center gap-3 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              Invigilation
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px]',
                  connected
                    ? 'border-trace/35 bg-trace/12 text-trace'
                    : 'border-fault/35 bg-fault/12 text-fault',
                )}
              >
                {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {connected ? 'LIVE' : 'RECONNECTING'}
              </span>
            </h1>
          </div>

          <Button variant={audio ? 'brass' : 'outline'} onClick={() => setAudio((value) => !value)}>
            {audio ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            Audio alerts {audio ? 'on' : 'off'}
          </Button>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Panel className="p-4">
            <Users className="h-[18px] w-[18px] text-violet-lit" strokeWidth={1.6} />
            <div className="mt-3 text-[28px] leading-none font-semibold text-paper tabular">
              {totals.active}
              <span className="text-[16px] text-faint">/{rows.length}</span>
            </div>
            <div className="instrument mt-1.5">active now</div>
          </Panel>
          <Panel className="p-4">
            <ShieldAlert
              className={cn('h-[18px] w-[18px]', violationTone(totals.violations))}
              strokeWidth={1.6}
            />
            <div className="mt-3 text-[28px] leading-none font-semibold text-paper tabular">
              {totals.violations}
            </div>
            <div className="instrument mt-1.5">total violations</div>
          </Panel>
          <Panel className="p-4">
            <Flag className="h-[18px] w-[18px] text-brass-lit" strokeWidth={1.6} />
            <div className="mt-3 text-[28px] leading-none font-semibold text-paper tabular">
              {totals.integrity}
            </div>
            <div className="instrument mt-1.5">average integrity</div>
          </Panel>
          <Panel className="p-4">
            <Users className="h-[18px] w-[18px] text-trace" strokeWidth={1.6} />
            <div className="mt-3 text-[28px] leading-none font-semibold text-paper tabular">
              {rows.filter((row) => row.submitted).length}
            </div>
            <div className="instrument mt-1.5">submitted</div>
          </Panel>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div>
            <span className="instrument">Students</span>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
              ) : rows.length === 0 ? (
                <Panel className="sm:col-span-2 xl:col-span-3">
                  <Empty
                    icon={Users}
                    title="Nobody has started the exam"
                    description="Cards appear here the moment a student opens their paper."
                  />
                </Panel>
              ) : (
                rows.map((student) => {
                  const status = statusOf(student, now);
                  const style = STATUS_STYLE[status];
                  return (
                    <button
                      key={student.attemptId}
                      onClick={() => setOpenAttempt(student.attemptId)}
                      className={cn(
                        'glass glass-lift p-4 text-left',
                        status === 'flagged' && 'border-fault/40 bg-fault/[0.05]',
                        status === 'removed' && 'border-fault/60 bg-fault/[0.10]',
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar
                          name={student.displayName}
                          avatar={student.avatar}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13.5px] text-paper">
                              {student.displayName}
                            </span>
                            {student.terminated ? (
                              <span className="shrink-0 rounded border border-fault/60 bg-fault/25 px-1.5 py-px font-mono text-[9px] tracking-[0.1em] text-fault">
                                REMOVED
                              </span>
                            ) : student.flagged ? (
                              <span className="shrink-0 rounded border border-fault/50 bg-fault/20 px-1.5 py-px font-mono text-[9px] tracking-[0.1em] text-fault">
                                FLAGGED
                              </span>
                            ) : null}
                          </div>
                          <div className="font-mono text-[10px] text-faint">
                            @{student.username}
                          </div>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full',
                              style.dot,
                              status === 'active' && 'animate-pulse',
                            )}
                          />
                          <span className="instrument">{style.label}</span>
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <div className="font-mono text-[13px] text-paper tabular">
                            {student.currentQuestion === null
                              ? '—'
                              : `Q${student.currentQuestion + 1}`}
                          </div>
                          <div className="instrument mt-0.5">on</div>
                        </div>
                        <div>
                          <div className="font-mono text-[13px] text-paper tabular">
                            {student.timeRemaining === null
                              ? '—'
                              : formatClock(student.timeRemaining)}
                          </div>
                          <div className="instrument mt-0.5">left</div>
                        </div>
                        <div>
                          <div
                            className={cn(
                              'font-mono text-[13px] tabular',
                              violationTone(student.violationCount),
                            )}
                          >
                            {student.violationCount}
                          </div>
                          <div className="instrument mt-0.5">flags</div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-baseline justify-between">
                          <span className="instrument">Integrity</span>
                          <span
                            className={cn(
                              'font-mono text-[11px] tabular',
                              student.integrityScore >= 85
                                ? 'text-trace'
                                : student.integrityScore >= 60
                                  ? 'text-warn'
                                  : 'text-fault',
                            )}
                          >
                            {student.integrityScore}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full border border-line bg-ink-sunken">
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width] duration-500',
                              student.integrityScore >= 85
                                ? 'bg-trace'
                                : student.integrityScore >= 60
                                  ? 'bg-warn'
                                  : 'bg-fault',
                            )}
                            style={{ width: `${student.integrityScore}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <Panel className="h-fit lg:sticky lg:top-20">
            <PanelHeader
              label="Feed"
              title="Violations as they happen"
              action={
                feed.length > 0 ? (
                  <span className="font-mono text-[11px] text-faint tabular">{feed.length}</span>
                ) : null
              }
            />
            <PanelBody className="max-h-[28rem] overflow-y-auto pt-3">
              {feed.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-faint">
                  Nothing flagged yet. Events appear the instant they are detected.
                </p>
              ) : (
                <ul className="space-y-2">
                  {feed.map((event) => (
                    <li
                      key={event.id}
                      className={cn(
                        'rounded-lg border px-3 py-2',
                        event.critical
                          ? 'border-fault/30 bg-fault/[0.06]'
                          : 'border-line bg-white/[0.02]',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Badge tone={event.critical ? 'fail' : 'warn'}>{event.label}</Badge>
                        <span className="ml-auto font-mono text-[10px] text-faint">
                          −{event.weight}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] text-paper">{event.message}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-faint">
                        {relativeTime(event.createdAt)} · integrity {event.integrityScore}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>

      <StudentDrawer
        attemptId={openAttempt}
        student={openAttempt ? (students.get(openAttempt) ?? null) : null}
        onClose={() => setOpenAttempt(null)}
      />
    </PageTransition>
  );
}

function StudentDrawer({
  attemptId,
  student,
  onClose,
}: {
  attemptId: string | null;
  student: StudentState | null;
  onClose: () => void;
}) {
  const [violations, setViolations] = useState<ViolationRow[] | null>(null);
  const [notes, setNotes] = useState<ProctorNote[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    if (!attemptId) return;
    void api
      .get<ViolationRow[]>(`/proctoring/violations?examAttemptId=${attemptId}`)
      .then(setViolations)
      .catch(() => setViolations([]));
    void api
      .get<ProctorNote[]>(`/proctoring/attempts/${attemptId}/notes`)
      .then(setNotes)
      .catch(() => setNotes([]));
  }, [attemptId]);

  useEffect(() => {
    setViolations(null);
    setNotes([]);
    setNote('');
    setReason('');
    setRemoveOpen(false);
    load();
  }, [attemptId, load]);

  async function flag() {
    if (!attemptId || !note.trim()) return;
    setBusy(true);
    try {
      await api.post(`/proctoring/attempts/${attemptId}/flag`, { note: note.trim() });
      toast.success('Note recorded on this attempt');
      setNote('');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not record that note');
    } finally {
      setBusy(false);
    }
  }

  async function removeFromExam() {
    if (!attemptId || !reason.trim()) return;
    setRemoving(true);
    try {
      await api.post(`/proctoring/attempts/${attemptId}/terminate`, { reason: reason.trim() });
      // The board updates from the socket broadcast, not from here.
      toast.success('Student removed from the exam');
      setRemoveOpen(false);
      setReason('');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove that student');
    } finally {
      setRemoving(false);
    }
  }

  async function readmit() {
    if (!attemptId) return;
    setRemoving(true);
    try {
      await api.post(`/proctoring/attempts/${attemptId}/readmit`);
      toast.success('Student readmitted — they can reopen the paper');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not readmit that student');
    } finally {
      setRemoving(false);
    }
  }

  const detections = (violations ?? []).filter((row) => row.typeKey !== 'MANUAL');

  return (
    <Modal
      open={attemptId !== null}
      onClose={onClose}
      label="Attempt"
      title={student?.displayName ?? 'Student'}
      description={
        student
          ? `Integrity ${student.integrityScore} · ${student.violationCount} violation${
              student.violationCount === 1 ? '' : 's'
            }`
          : undefined
      }
      className="max-w-2xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      {student?.terminated ? (
        <div className="mb-5 rounded-lg border border-fault/40 bg-fault/[0.08] p-4">
          <div className="flex items-center gap-2 text-[13px] font-medium text-fault">
            <UserX className="h-4 w-4" strokeWidth={1.8} />
            Removed from the exam
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">
            {student.terminatedReason ?? 'No reason recorded.'}
          </p>
          <p className="mt-1 font-mono text-[10px] text-faint">
            {student.terminatedBy ? `By ${student.terminatedBy}` : 'Automatic — violation threshold'}
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            loading={removing}
            onClick={() => void readmit()}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Readmit to exam
          </Button>
          <p className="mt-2 text-[11.5px] text-faint">
            Reopens the paper against its original deadline. Past violations stay on record but stop
            counting towards removal.
          </p>
        </div>
      ) : null}

      <section>
        <span className="instrument">Timeline</span>
        <div className="hairline mt-1.5 w-10" />

        {violations === null ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : detections.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">
            Nothing detected on this attempt. A clean run so far.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {detections.map((row) => (
              <li key={row.id} className="rounded-lg border border-line bg-white/[0.02] p-3">
                <div className="flex items-center gap-2">
                  <Badge tone={row.critical ? 'fail' : 'warn'}>{row.label}</Badge>
                  <span className="font-mono text-[10px] text-faint">−{row.weight}</span>
                  <span className="ml-auto font-mono text-[10px] text-faint">
                    {relativeTime(row.createdAt)}
                    {row.timeRemaining !== null
                      ? ` · ${formatClock(row.timeRemaining)} left`
                      : ''}
                  </span>
                </div>
                {row.codeSnapshot ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-mono text-[10px] text-faint hover:text-muted">
                      Code at this moment
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-line bg-ink-sunken p-2.5 font-mono text-[11px] whitespace-pre-wrap text-paper">
                      {row.codeSnapshot}
                    </pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <span className="instrument">Proctor notes</span>
        <div className="hairline mt-1.5 w-10" />

        {notes.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {notes.map((row) => (
              <li key={row.id} className="rounded-lg border border-brass/25 bg-brass/[0.06] p-3">
                <p className="text-[13px] text-paper">{row.note}</p>
                <p className="mt-1 font-mono text-[10px] text-faint">
                  {row.by} · {relativeTime(row.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        <Textarea
          rows={3}
          className="mt-3"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What did you observe?"
        />
        <Button
          className="mt-2"
          size="sm"
          variant="brass"
          loading={busy}
          disabled={!note.trim()}
          onClick={() => void flag()}
        >
          <Flag className="h-3.5 w-3.5" />
          Add note
        </Button>
      </section>

      {student && !student.terminated ? (
        <section className="mt-6 border-t border-line pt-5">
          <span className="instrument">Remove from exam</span>
          <div className="hairline mt-1.5 w-10" />

          {removeOpen ? (
            <>
              <p className="mt-3 text-[12.5px] text-muted">
                This closes {student.displayName}&rsquo;s paper immediately. Their answers so far are
                scored and kept, and they cannot reopen it until you readmit them. The reason below
                is shown to them.
              </p>
              <Textarea
                rows={2}
                className="mt-3"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why are you removing this student?"
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  loading={removing}
                  disabled={!reason.trim()}
                  onClick={() => void removeFromExam()}
                >
                  <UserX className="h-3.5 w-3.5" />
                  Confirm removal
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoveOpen(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => setRemoveOpen(true)}
            >
              <UserX className="h-3.5 w-3.5" />
              Remove from exam
            </Button>
          )}
        </section>
      ) : null}
    </Modal>
  );
}
