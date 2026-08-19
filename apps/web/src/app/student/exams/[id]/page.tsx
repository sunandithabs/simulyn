'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Flag,
  Maximize,
  Play,
  Send,
  ShieldAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { CodeEditor } from '@/components/problem/code-editor';
import { ProblemBrief } from '@/components/problem/problem-brief';
import { ConsoleOutput, TestResults } from '@/components/problem/results-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { useLockdown } from '@/components/layout/lockdown';
import { useProctoring, FLAG_THRESHOLD, type TerminationNotice } from '@/hooks/useProctoring';
import { api } from '@/lib/api';
import type {
  EvaluationResult,
  ExamDetail,
  ExamStartResponse,
  LangKey,
  LanguageEnum,
  RunResult,
  Submission,
} from '@/lib/types';
import { cn, formatClock, formatDateTime } from '@/lib/utils';

const LANGUAGES: { key: LangKey; label: string; enumValue: LanguageEnum }[] = [
  { key: 'python', label: 'Python 3', enumValue: 'PYTHON' },
  { key: 'javascript', label: 'JavaScript', enumValue: 'JAVASCRIPT' },
  { key: 'cpp', label: 'C++17', enumValue: 'CPP' },
  { key: 'java', label: 'Java 17', enumValue: 'JAVA' },
];

interface AnswerState {
  code: string;
  language: LangKey;
  submitted: boolean;
  passed: boolean;
}

export default function StudentExamPage() {
  const examId = useParams<{ id: string }>().id;
  const router = useRouter();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [attempt, setAttempt] = useState<ExamStartResponse | null>(null);
  const [starting, setStarting] = useState(false);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [bottom, setBottom] = useState<'tests' | 'console'>('tests');
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  /** Set when a proctor — or the violation threshold — ends the attempt. */
  const [removed, setRemoved] = useState<TerminationNotice | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(true);

  const submitLock = useRef(false);
  const flaggedNotified = useRef(false);
  const { setLocked } = useLockdown();

  /** True from the moment the paper opens until it is submitted or ended. */
  const inProgress = Boolean(attempt) && !finished && removed === null;

  const questions = attempt?.questions ?? [];
  const current = questions[index];
  const answer = current ? answers[current.problem.id] : undefined;

  // ── loading ───────────────────────────────────────────────────────
  useEffect(() => {
    void api
      .get<ExamDetail>(`/exams/${examId}`)
      .then(setExam)
      .catch(() => {
        toast.error('That exam could not be loaded');
        router.push('/student/exams');
      });
  }, [examId, router]);

  /**
   * Fullscreen is requested, not required: some browsers refuse a programmatic
   * request outside a trusted gesture, and failing that is not a reason to stop
   * a student sitting their exam. The banner and the FULLSCREEN violation carry
   * the enforcement instead.
   */
  const goFullscreen = useCallback(async (announce: boolean) => {
    try {
      await document.documentElement.requestFullscreen?.();
      setFullscreen(true);
    } catch {
      setFullscreen(false);
      if (announce) toast.warning('Please allow fullscreen for proctored exams');
    }
  }, []);

  const startExam = useCallback(async () => {
    setStarting(true);
    try {
      const started = await api.post<ExamStartResponse>(`/exams/${examId}/start`);
      setAttempt(started);
      setAnswers(
        Object.fromEntries(
          started.questions.map((question) => [
            question.problem.id,
            {
              code: question.problem.starterCode?.python ?? '',
              language: 'python' as LangKey,
              submitted: false,
              passed: false,
            },
          ]),
        ),
      );
      toast.success('Exam started — good luck');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start the exam');
    } finally {
      setStarting(false);
    }
  }, [examId]);

  // ── the clock ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!attempt || finished) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.round((new Date(attempt.endsAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt, finished]);

  const submitExam = useCallback(
    async (auto: boolean) => {
      if (submitLock.current) return;
      submitLock.current = true;
      try {
        await api.post(`/exams/${examId}/submit`, { autoSubmitted: auto });
        setFinished(true);
        toast[auto ? 'warning' : 'success'](
          auto ? 'Time is up — your exam was submitted' : 'Exam submitted',
        );
      } catch (error) {
        submitLock.current = false;
        toast.error(error instanceof Error ? error.message : 'Could not submit the exam');
      }
    },
    [examId],
  );

  // Auto-submit the moment the timer runs out.
  useEffect(() => {
    if (secondsLeft === 0 && attempt && !finished) void submitExam(true);
  }, [secondsLeft, attempt, finished, submitExam]);

  // ── lockdown ──────────────────────────────────────────────────────
  // Hides the shell's navigation for as long as the paper is open.
  useEffect(() => {
    setLocked(inProgress);
    return () => setLocked(false);
  }, [inProgress, setLocked]);

  // Keep the banner in step with the actual fullscreen state.
  useEffect(() => {
    if (!inProgress) return;
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [inProgress]);

  /**
   * Back-button interception. A history entry is pushed when the paper opens,
   * so the first Back lands on it rather than leaving the exam; the entry is
   * then pushed again to stay ahead of another press.
   */
  useEffect(() => {
    if (!inProgress) return;

    window.history.pushState({ simulynExam: examId }, '');
    const onPopState = () => {
      window.history.pushState({ simulynExam: examId }, '');
      toast.warning('You cannot leave an exam in progress', {
        description: 'Submit the exam to return to the rest of the workspace.',
      });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [inProgress, examId]);

  /**
   * The attempt is over: it is already scored and closed server-side, so there
   * is nothing to submit — leave fullscreen and show the student why.
   */
  const handleTerminated = useCallback((notice: TerminationNotice) => {
    submitLock.current = true;
    setRemoved(notice);
    void document.exitFullscreen?.().catch(() => undefined);
  }, []);

  // ── proctoring ────────────────────────────────────────────────────
  const proctoring = useProctoring({
    examId,
    attemptId: attempt?.attemptId ?? null,
    enabled: inProgress,
    // Copying inside the paper is fine; pasting from outside it is not.
    restrictClipboard: true,
    getSnapshot: () => (current ? (answers[current.problem.id]?.code ?? '') : ''),
    getCurrentQuestion: () => index,
    getTimeRemaining: () => secondsLeft ?? 0,
    onExamEnded: () => void submitExam(true),
    onTerminated: handleTerminated,
  });

  useEffect(() => {
    if (!proctoring.lastAlert) return;
    toast.warning(proctoring.lastAlert.message, { description: 'Recorded by the proctor.' });
  }, [proctoring.lastAlert]);

  // Warned once, on the approach — removal at the threshold should not be the
  // first the student hears of it.
  useEffect(() => {
    const remaining = FLAG_THRESHOLD - proctoring.violationCount;
    if (remaining > 3 || remaining <= 0 || flaggedNotified.current) return;
    flaggedNotified.current = true;
    toast.error(`${remaining} more violation${remaining === 1 ? '' : 's'} will end your exam.`, {
      description: 'Your instructor is watching this attempt.',
      duration: 12_000,
    });
  }, [proctoring.violationCount]);

  // ── answering ─────────────────────────────────────────────────────
  function patchAnswer(problemId: string, patch: Partial<AnswerState>) {
    setAnswers((previous) => ({ ...previous, [problemId]: { ...previous[problemId], ...patch } }));
  }

  async function run() {
    if (!current || !answer) return;
    setRunning(true);
    setBottom('console');
    try {
      setRunResult(
        await api.post<RunResult>('/execute/run', { code: answer.code, lang: answer.language }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not run your code');
    } finally {
      setRunning(false);
    }
  }

  async function submitAnswer() {
    if (!current || !answer || !attempt) return;
    setSubmittingAnswer(true);
    setBottom('tests');
    try {
      const result = await api.post<Submission>('/submissions', {
        problemId: current.problem.id,
        code: answer.code,
        language: LANGUAGES.find((entry) => entry.key === answer.language)!.enumValue,
        examAttemptId: attempt.attemptId,
      });

      setEvaluation({
        ok: true,
        allPassed: result.passed,
        compileError: result.compileError,
        results: result.testResults.map((row, i) => ({ ...row, index: i })),
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        totalMs: result.executionMs ?? 0,
      });
      patchAnswer(current.problem.id, { submitted: true, passed: result.passed });

      if (result.passed) toast.success(`Answer accepted — ${result.score} points`);
      else toast.error(`${result.passedCount} of ${result.totalCount} cases passed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit this answer');
    } finally {
      setSubmittingAnswer(false);
    }
  }

  const unanswered = useMemo(
    () => questions.filter((question) => !answers[question.problem.id]?.submitted).length,
    [questions, answers],
  );

  // ── before the paper opens ────────────────────────────────────────
  if (!attempt) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link
          href="/student/exams"
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-paper"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All exams
        </Link>

        {!exam ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <Panel className="p-6">
            <span className="instrument">{exam.class.name}</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              {exam.title}
            </h1>
            {exam.description ? (
              <p className="mt-2 text-sm text-muted">{exam.description}</p>
            ) : null}

            <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-line py-4 sm:grid-cols-4">
              {[
                ['duration', `${exam.durationMin} min`],
                ['questions', String(exam._count.problems)],
                ['opens', formatDateTime(exam.scheduledStart)],
                ['closes', formatDateTime(exam.scheduledEnd)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dd className="font-mono text-[13px] text-paper">{value}</dd>
                  <dt className="instrument mt-1">{label}</dt>
                </div>
              ))}
            </dl>

            <div className="mt-5 rounded-lg border border-warn/30 bg-warn/[0.07] p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium text-warn">
                <ShieldAlert className="h-4 w-4" strokeWidth={1.8} />
                This exam is proctored
              </div>
              <ul className="mt-2 space-y-1 text-[12.5px] text-muted">
                <li>
                  · You may copy and paste <em>within</em> the exam — a test case from the brief
                  into your editor, for instance. Pasting anything from outside is blocked and
                  recorded.
                </li>
                <li>· Right-clicking, and leaving the tab or window, are recorded.</li>
                <li>· Your integrity score starts at 100 and drops with each violation.</li>
                <li>
                  · {FLAG_THRESHOLD} violations remove you from the exam. Only your instructor can
                  let you back in.
                </li>
                <li>· The timer keeps running once you start, even if you close the page.</li>
              </ul>
            </div>

            {exam.attempt?.terminated ? (
              <div className="mt-5 rounded-lg border border-fault/40 bg-fault/[0.08] px-4 py-3">
                <div className="flex items-center gap-2 text-[13px] font-medium text-fault">
                  <ShieldAlert className="h-4 w-4" strokeWidth={1.8} />
                  You were removed from this exam
                </div>
                <p className="mt-1.5 text-[12.5px] text-muted">
                  {exam.attempt.terminatedReason ?? 'Speak to your instructor.'}
                </p>
              </div>
            ) : exam.attempt?.submittedAt ? (
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-trace/30 bg-trace/[0.06] px-4 py-3 text-[13px] text-trace">
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                You submitted this exam · {exam.attempt.totalScore} points · integrity{' '}
                {exam.attempt.integrityScore}
              </div>
            ) : exam.status === 'ACTIVE' ? (
              <Button
                size="lg"
                className="mt-5 w-full"
                loading={starting}
                onClick={async () => {
                  await goFullscreen(true);
                  void startExam();
                }}
              >
                <Play className="h-4 w-4" />
                Start exam
              </Button>
            ) : (
              <div className="mt-5 rounded-lg border border-line px-4 py-3 text-center text-[13px] text-muted">
                {exam.status === 'SCHEDULED'
                  ? `Opens ${formatDateTime(exam.scheduledStart)}`
                  : 'This exam has closed'}
              </div>
            )}
          </Panel>
        )}
      </div>
    );
  }

  // ── removed mid-exam ──────────────────────────────────────────────
  if (removed) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-fault/35 bg-fault/12">
          <ShieldAlert className="h-6 w-6 text-fault" strokeWidth={1.5} />
        </div>
        <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-white">
          You have been removed from this exam
        </h1>
        <p className="mt-2 text-sm text-muted">{removed.reason}</p>
        <p className="mt-4 text-[13px] text-faint">
          {removed.by
            ? `Removed by ${removed.by}.`
            : `Removed automatically after ${removed.violationCount} violations.`}{' '}
          Your answers up to this point have been saved and scored. Speak to your instructor if you
          believe this is a mistake — only they can let you back in.
        </p>
        <Link href="/student/exams" className="mt-6">
          <Button variant="outline">Back to exams</Button>
        </Link>
      </div>
    );
  }

  // ── after submitting ──────────────────────────────────────────────
  if (finished) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-trace/35 bg-trace/12">
          <CheckCircle2 className="h-6 w-6 text-trace" strokeWidth={1.5} />
        </div>
        <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-white">
          Exam submitted
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your answers are locked in. Your instructor will publish results.
        </p>
        <Link href="/student/exams" className="mt-6">
          <Button variant="outline">Back to exams</Button>
        </Link>
      </div>
    );
  }

  // ── the paper ─────────────────────────────────────────────────────
  const lowTime = secondsLeft !== null && secondsLeft < 300;

  return (
    <div className="flex h-dvh flex-col">
      {!fullscreen ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-warn/40 bg-warn/[0.12] px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" strokeWidth={1.9} />
          <span className="flex-1 text-[13px] font-medium text-warn">
            Return to fullscreen — this is being recorded
          </span>
          <Button variant="brass" size="sm" onClick={() => void goFullscreen(false)}>
            <Maximize className="h-3.5 w-3.5" />
            Go fullscreen
          </Button>
        </div>
      ) : null}

      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-ink-raised/60 px-4 py-2.5 backdrop-blur-xl">
        <div className="min-w-0">
          <span className="instrument">Exam in progress</span>
          <div className="truncate text-[14px] font-medium text-paper">{attempt.title}</div>
        </div>

        <nav className="flex flex-1 items-center justify-center gap-1.5" aria-label="Questions">
          {questions.map((question, i) => {
            const state = answers[question.problem.id];
            return (
              <button
                key={question.problem.id}
                onClick={() => {
                  setIndex(i);
                  setEvaluation(null);
                  setRunResult(null);
                }}
                aria-label={`Question ${i + 1}${state?.submitted ? ', answered' : ''}`}
                aria-current={i === index}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-[12px] transition-all duration-200',
                  i === index
                    ? 'border-violet-lit bg-violet/25 text-paper'
                    : state?.submitted
                      ? state.passed
                        ? 'border-trace/40 bg-trace/12 text-trace'
                        : 'border-warn/40 bg-warn/12 text-warn'
                      : 'border-line text-muted hover:border-white/25',
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex items-center gap-1.5 font-mono text-[11px]',
              proctoring.connected ? 'text-trace' : 'text-fault',
            )}
            title={proctoring.connected ? 'Proctoring connected' : 'Proctoring offline'}
          >
            {proctoring.connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          </span>

          {proctoring.violationCount > 0 ? (
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px]',
                proctoring.violationCount >= FLAG_THRESHOLD
                  ? 'border-fault/45 bg-fault/15 text-fault'
                  : 'border-warn/35 bg-warn/12 text-warn',
              )}
              title="Violations recorded on this attempt"
            >
              {proctoring.violationCount >= FLAG_THRESHOLD ? (
                <Flag className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {proctoring.violationCount >= FLAG_THRESHOLD ? 'FLAGGED · ' : ''}
              {proctoring.violationCount} · integrity {proctoring.integrityScore}
            </span>
          ) : null}

          <span
            className={cn(
              'rounded-md border px-2.5 py-1 font-mono text-[15px] font-semibold tabular',
              lowTime
                ? 'animate-pulse border-fault/40 bg-fault/12 text-fault'
                : 'border-line-strong bg-ink-sunken text-paper',
            )}
          >
            {secondsLeft === null ? '--:--' : formatClock(secondsLeft)}
          </span>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Enter fullscreen"
            onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
          >
            <Maximize className="h-4 w-4" />
          </Button>

          <Button size="sm" onClick={() => setConfirmOpen(true)}>
            <Send className="h-3.5 w-3.5" />
            Submit exam
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="min-h-0 shrink-0 overflow-y-auto border-b border-line p-5 lg:w-[42%] lg:border-r lg:border-b-0">
          {/* Hints are a learning aid, not an exam aid. */}
          {current ? <ProblemBrief problem={current.problem} hideHints /> : null}
        </section>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Select
              value={answer?.language ?? 'python'}
              aria-label="Language"
              onChange={(event) => {
                if (!current) return;
                const language = event.target.value as LangKey;
                const existing = answers[current.problem.id];
                patchAnswer(current.problem.id, {
                  language,
                  code:
                    existing?.code && existing.language === language
                      ? existing.code
                      : (current.problem.starterCode?.[language] ?? ''),
                });
              }}
            >
              {LANGUAGES.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </Select>

            <span className="font-mono text-[11px] text-brass-lit tabular">
              {current?.points} pts
            </span>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void run()} loading={running}>
                <Play className="h-3.5 w-3.5" />
                Run
              </Button>
              <Button size="sm" onClick={() => void submitAnswer()} loading={submittingAnswer}>
                <Send className="h-3.5 w-3.5" />
                Submit answer
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {current ? (
              <CodeEditor
                language={answer?.language ?? 'python'}
                value={answer?.code ?? ''}
                onChange={(value) => patchAnswer(current.problem.id, { code: value })}
                onRun={() => void run()}
                onSubmit={() => void submitAnswer()}
              />
            ) : null}
          </div>

          <div className="flex h-[34%] min-h-[160px] flex-col border-t border-line">
            <div className="flex items-center gap-1 border-b border-line px-2">
              {(
                [
                  { value: 'tests', label: 'Test results' },
                  { value: 'console', label: 'Console' },
                ] as const
              ).map((entry) => (
                <button
                  key={entry.value}
                  onClick={() => setBottom(entry.value)}
                  className={cn(
                    'relative px-3 py-2.5 text-[12.5px] transition-colors',
                    bottom === entry.value ? 'text-paper' : 'text-muted hover:text-paper',
                  )}
                >
                  {entry.label}
                  {bottom === entry.value ? (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet-lit" />
                  ) : null}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-1 pr-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => {
                    setIndex((value) => value - 1);
                    setEvaluation(null);
                    setRunResult(null);
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index >= questions.length - 1}
                  onClick={() => {
                    setIndex((value) => value + 1);
                    setEvaluation(null);
                    setRunResult(null);
                  }}
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {bottom === 'tests' ? (
                <TestResults evaluation={evaluation} running={submittingAnswer} />
              ) : (
                <ConsoleOutput
                  result={runResult}
                  running={running}
                  language={answer?.language ?? 'python'}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        label="Final step"
        title="Submit the exam?"
        description="Once submitted you cannot reopen the paper or change an answer."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Keep working
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                void submitExam(false);
              }}
            >
              Submit exam
            </Button>
          </>
        }
      >
        {unanswered > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/[0.07] px-3 py-2.5 text-[13px] text-warn">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
            <span>
              {unanswered} of {questions.length} question{questions.length === 1 ? '' : 's'} still
              have no submitted answer.
            </span>
          </div>
        ) : (
          <p className="text-[13px] text-trace">All questions have a submitted answer.</p>
        )}

        <ul className="mt-4 space-y-1.5">
          {questions.map((question, i) => {
            const state = answers[question.problem.id];
            return (
              <li key={question.problem.id} className="flex items-center gap-2.5">
                <span className="w-5 font-mono text-[11px] text-faint tabular">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-paper">
                  {question.problem.title}
                </span>
                {state?.submitted ? (
                  <Badge tone={state.passed ? 'pass' : 'warn'}>
                    {state.passed ? 'passed' : 'submitted'}
                  </Badge>
                ) : (
                  <Badge>no answer</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </Modal>
    </div>
  );
}
