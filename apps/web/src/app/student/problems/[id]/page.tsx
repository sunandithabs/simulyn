'use client';

import { ArrowLeft, AlignLeft, Play, Send, Sparkles, Terminal, TestTube2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { DiscussionThread } from '@/components/discussion/DiscussionThread';
import { PageTransition } from '@/components/layout/app-shell';
const CodeEditor = dynamic(() => import('@/components/problem/code-editor').then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => <div className="h-full min-h-64 w-full animate-pulse rounded-lg bg-white/5" />,
});
import { ElectronicsPanel } from '@/components/problem/electronics-panel';
import { MentorPanel } from '@/components/problem/mentor-panel';
import { ProblemBrief } from '@/components/problem/problem-brief';
import { CustomRunPanel, TestResults } from '@/components/problem/results-panel';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveVisualizer } from '@/components/visualizer/resolve';
import type { TraceResult } from '@/components/visualizer/types';
import { VizDrawer } from '@/components/visualizer/viz-drawer';
import { VizTrigger } from '@/components/visualizer/viz-trigger';
import { api } from '@/lib/api';
import type {
  EvaluationResult,
  LangKey,
  LanguageEnum,
  Problem,
  RunResult,
  Submission,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const LANGUAGES: { key: LangKey; label: string; enumValue: LanguageEnum }[] = [
  { key: 'python', label: 'Python 3', enumValue: 'PYTHON' },
  { key: 'javascript', label: 'JavaScript', enumValue: 'JAVASCRIPT' },
  { key: 'cpp', label: 'C++17', enumValue: 'CPP' },
  { key: 'java', label: 'Java 17', enumValue: 'JAVA' },
];

type BottomTab = 'tests' | 'console' | 'mentor';

const draftKey = (problemId: string, language: LangKey) => `simulyn.draft.${problemId}.${language}`;

export default function ProblemSolverPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const problemId = params.id;

  const [problem, setProblem] = useState<Problem | null>(null);
  const [language, setLanguage] = useState<LangKey>('python');
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<BottomTab>('tests');
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const [errorText, setErrorText] = useState('');
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [customRunning, setCustomRunning] = useState(false);
  const [traceCase, setTraceCase] = useState(0);
  const [saved, setSaved] = useState(false);
  const editorApi = useRef<{ format: () => void } | null>(null);

  const [running, setRunning] = useState(false);
  const [evalMode, setEvalMode] = useState<'run' | 'submit'>('run');
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  const [split, setSplit] = useState(44);
  const dragging = useRef(false);

  // Visualiser: a trace is fetched alongside Run, then replayed in the drawer.
  const [vizOpen, setVizOpen] = useState(false);
  const [vizSeen, setVizSeen] = useState(false);
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [tracing, setTracing] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const traceToken = useRef(0);
  const plan = useMemo(() => (problem ? resolveVisualizer(problem) : null), [problem]);

  useEffect(() => {
    // Same page component is reused across ids: drop anything from the last problem.
    setProblem(null);
    setCode('');
    setTrace(null);
    setTraceError(null);
    setEvaluation(null);
    setRunResult(null);
    setVizOpen(false);
    setErrorLine(null);
    setActiveLine(null);
    setTraceCase(0);
    traceToken.current += 1;
    let alive = true;
    void api
      .get<Problem>(`/problems/${problemId}`)
      .then((result) => alive && setProblem(result))
      .catch(() => {
        toast.error('That problem could not be loaded');
        router.push('/student/problems');
      });
    return () => {
      alive = false;
    };
  }, [problemId, router]);

  // Load the saved draft for this problem+language, else the starter stub.
  useEffect(() => {
    if (!problem) return;
    const draft = window.localStorage.getItem(draftKey(problem.id, language));
    setCode(draft ?? problem.starterCode?.[language] ?? '');
    setErrorLine(null);
    setSaved(false);
  }, [problem, language]);

  useEffect(() => {
    if (problem) setCustomInput(problem.testCases?.find((c) => !c.isHidden)?.input ?? '');
  }, [problem]);

  useEffect(() => {
    if (!problem || !code) return;
    const timer = setTimeout(() => {
      window.localStorage.setItem(draftKey(problem.id, language), code);
      setSaved(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [code, problem, language]);

  /**
   * Traces the solution against the first visible test case so the drawer has
   * something to replay. Runs alongside Run and never blocks it — a trace
   * failing is not a reason for Run to look broken.
   */
  const refreshTrace = useCallback(async (caseIndex?: number) => {
    if (!problem || problem.type !== 'PROGRAMMING' || !plan) return;
    setTracing(true);
    setTraceError(null);
    const token = ++traceToken.current;
    try {
      const result = await api.post<TraceResult>('/execute/trace', {
        problemId: problem.id,
        code,
        lang: language,
        testCaseIndex: caseIndex ?? traceCase,
      });
      // Ignore a reply that belongs to an older run or a different problem.
      if (token === traceToken.current) setTrace(result);
    } catch (error) {
      if (token !== traceToken.current) return;
      // Surfaced in the drawer rather than swallowed — a silent failure here
      // looks exactly like a broken visualiser.
      setTrace(null);
      setTraceError(error instanceof Error ? error.message : 'Could not trace this run');
    } finally {
      if (token === traceToken.current) setTracing(false);
    }
  }, [problem, plan, code, language, traceCase]);

  const run = useCallback(async () => {
    if (!problem || running || submitting) return;
    setRunning(true);
    setEvalMode('run');
    setTab('tests');
    void refreshTrace();
    try {
      const result = await api.post<EvaluationResult>('/execute/submit', {
        problemId: problem.id,
        code,
        lang: language,
        visibleOnly: true,
      });
      setEvaluation(result);
      setErrorLine(result.errorLine ?? null);
      setErrorText(result.compileError ?? result.results.find((r) => r.stderr)?.stderr ?? '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not run your code');
    } finally {
      setRunning(false);
    }
  }, [problem, code, language, refreshTrace, running, submitting]);

  const runCustom = useCallback(async () => {
    if (!problem) return;
    setCustomRunning(true);
    try {
      const result = await api.post<RunResult>('/execute/run', {
        code,
        lang: language,
        problemId: problem.id,
        stdin: customInput,
      });
      setRunResult(result);
      setErrorLine(result.errorLine ?? null);
      setErrorText(result.compileError ?? result.stderr ?? '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not run your input');
    } finally {
      setCustomRunning(false);
    }
  }, [problem, code, language, customInput]);

  const submit = useCallback(async () => {
    if (!problem || running || submitting) return;
    setSubmitting(true);
    setEvalMode('submit');
    setTab('tests');
    try {
      const languageEnum = LANGUAGES.find((entry) => entry.key === language)!.enumValue;
      const result = await api.post<Submission>('/submissions', {
        problemId: problem.id,
        code,
        language: languageEnum,
      });

      setEvaluation({
        ok: true,
        allPassed: result.passed,
        compileError: result.compileError,
        errorLine: result.errorLine ?? null,
        results: result.testResults.map((row, index) => ({ ...row, index })),
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        totalMs: result.executionMs ?? 0,
      });

      setErrorLine(result.errorLine ?? null);
      setErrorText(result.compileError ?? '');
      if (result.passed) {
        toast.success(`Accepted. We are so back. ${result.score} points`);
        if (result.reward?.xpAwarded) {
          toast.success(`+${result.reward.xpAwarded} XP`, {
            description: result.reward.leveledUp ? `Level ${result.reward.level} reached` : undefined,
          });
        }
        for (const badge of result.reward?.newBadges ?? []) {
          toast(`${badge.icon}  ${badge.name}`, { description: badge.description });
        }
      } else {
        toast.error(`${result.passedCount} of ${result.totalCount} cases passed`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit your solution');
    } finally {
      setSubmitting(false);
    }
  }, [problem, code, language]);

  // Split-pane drag.
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      const percentage = (event.clientX / window.innerWidth) * 100;
      setSplit(Math.min(70, Math.max(24, percentage)));
    };
    const stop = () => {
      dragging.current = false;
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
  }, []);

  if (!problem) {
    return (
      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <Skeleton className="h-[70dvh] w-full" />
        <Skeleton className="h-[70dvh] w-full" />
      </div>
    );
  }

  const isElectronics = problem.type === 'ELECTRONICS';

  return (
    <PageTransition>
      <div className="coding-workspace flex h-[calc(100dvh-57px)] flex-col lg:flex-row">
        {/* Left: the statement */}
        <section
          className="min-h-0 shrink-0 overflow-y-auto border-b border-line lg:border-r lg:border-b-0"
          style={{ width: undefined, flexBasis: isElectronics ? '46%' : `${split}%` }}
        >
          {plan && vizOpen && !isElectronics ? (
            <VizDrawer
              docked
              open={vizOpen}
              onClose={() => setVizOpen(false)}
              problem={problem}
              plan={plan}
              trace={trace}
              loading={tracing}
              error={traceError}
              cases={problem.testCases?.filter((c) => !c.isHidden)}
              caseIndex={traceCase}
              onCaseChange={(index) => {
                setTraceCase(index);
                void refreshTrace(index);
              }}
              onLine={setActiveLine}
            />
          ) : (
          <div className="coding-brief p-5 sm:p-6">
            <Link
              href="/student/problems"
              className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-paper"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All problems
            </Link>
            <ProblemBrief problem={problem} />
            <DiscussionThread problemId={problem.id} />
          </div>
          )}
        </section>

        {/* Drag handle — programming problems only, where the editor competes for width. */}
        {!isElectronics ? (
          <div
            onPointerDown={() => {
              dragging.current = true;
              document.body.style.userSelect = 'none';
            }}
            className="hidden w-1 cursor-col-resize bg-line transition-colors hover:bg-violet-lit/60 lg:block"
            role="separator"
            aria-orientation="vertical"
          />
        ) : null}

        {/* Right: the bench */}
        <section className="coding-bench flex min-h-0 min-w-0 flex-1 flex-col">
          {isElectronics ? (
            <div className="overflow-y-auto p-5 sm:p-6">
              <ElectronicsPanel
                problemId={problem.id}
                category={problem.category}
                questions={problem.questions ?? []}
                params={problem.params}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <Select
                  value={language}
                  onChange={(event) => {
                    // Keep the last keystrokes of this language's draft before switching.
                    if (code) window.localStorage.setItem(draftKey(problem.id, language), code);
                    setLanguage(event.target.value as LangKey);
                  }}
                  aria-label="Language"
                >
                  {LANGUAGES.map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.label}
                    </option>
                  ))}
                </Select>

                <Button
                  variant="ghost"
                  size="sm"
                  title="Format code"
                  aria-label="Format code"
                  onClick={() => editorApi.current?.format()}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                  Format
                </Button>
                {saved ? <span className="font-mono text-[10px] text-faint">saved</span> : null}

                <div className="ml-auto flex items-center gap-3">
                  {plan ? (
                    <VizTrigger
                      active={vizOpen}
                      pulse={!vizSeen}
                      onClick={() => {
                        setVizOpen((value) => !value);
                        setVizSeen(true);
                        if (!trace && !tracing) void refreshTrace();
                      }}
                    />
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      title="Run the sample cases. Not scored."
                      onClick={() => void run()}
                      loading={running}
                      disabled={submitting}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Run
                    </Button>
                    <Button size="sm" onClick={() => void submit()} loading={submitting} disabled={running}>
                      <Send className="h-3.5 w-3.5" />
                      Submit
                    </Button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1">
                <CodeEditor
                  language={language}
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    setErrorLine(null);
                    setSaved(false);
                  }}
                  activeLine={vizOpen ? activeLine : null}
                  errorLine={errorLine}
                  errorMessage={errorText.split('\n').find((l) => l.trim()) ?? undefined}
                  onReady={(api) => {
                    editorApi.current = api;
                  }}
                  onRun={() => void run()}
                  onSubmit={() => void submit()}
                />
              </div>

              <div className="flex h-[38%] min-h-[180px] flex-col border-t border-line">
                <div className="flex items-center gap-1 border-b border-line px-2">
                  {(
                    [
                      { value: 'tests', label: 'Test results', icon: TestTube2 },
                      { value: 'console', label: 'Custom input', icon: Terminal },
                      { value: 'mentor', label: 'AI mentor', icon: Sparkles },
                    ] as const
                  ).map((entry) => (
                    <button
                      key={entry.value}
                      onClick={() => setTab(entry.value)}
                      className={cn(
                        'relative flex items-center gap-1.5 px-3 py-2.5 text-[12.5px] transition-colors',
                        tab === entry.value ? 'text-paper' : 'text-muted hover:text-paper',
                      )}
                    >
                      <entry.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {entry.label}
                      {tab === entry.value ? (
                        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet-lit" />
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {tab === 'tests' ? (
                    <TestResults
                      evaluation={evaluation}
                      running={submitting || running}
                      mode={evalMode}
                      cases={problem.testCases?.filter((c) => !c.isHidden)}
                    />
                  ) : tab === 'console' ? (
                    <CustomRunPanel
                      input={customInput}
                      onInput={setCustomInput}
                      onRun={() => void runCustom()}
                      result={runResult}
                      running={customRunning}
                      language={language}
                    />
                  ) : (
                    <MentorPanel
                      problemId={problem.id}
                      language={LANGUAGES.find((entry) => entry.key === language)!.enumValue}
                      code={code}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {plan && isElectronics ? (
        <VizDrawer
          open={vizOpen}
          onClose={() => setVizOpen(false)}
          problem={problem}
          plan={plan}
          trace={trace}
          loading={tracing}
          error={traceError}
        />
      ) : null}
    </PageTransition>
  );
}
