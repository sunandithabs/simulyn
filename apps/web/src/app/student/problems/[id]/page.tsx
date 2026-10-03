'use client';

import {
  AlignLeft,
  ArrowLeft,
  Check,
  Keyboard,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Terminal,
  TestTube2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';

import { DiscussionThread } from '@/components/discussion/DiscussionThread';
import { PageTransition } from '@/components/layout/app-shell';
import {
  CodeEditor,
  type CodeEditorHandle,
  type EditorErrorMarker,
} from '@/components/problem/code-editor';
import { ElectronicsPanel } from '@/components/problem/electronics-panel';
import { MentorPanel } from '@/components/problem/mentor-panel';
import { ProblemBrief } from '@/components/problem/problem-brief';
import { ConsoleOutput, TestResults } from '@/components/problem/results-panel';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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

type DraftState = 'clean' | 'dirty' | 'saved' | 'failed';

/** First non-empty line of a compiler or traceback message — enough for a tooltip. */
function summarise(text: string | null | undefined, fallback: string): string {
  const lines = (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  // A Python traceback ends with the actual complaint; compilers lead with it.
  const pick = /^Traceback/.test(lines[0] ?? '') ? lines[lines.length - 1] : lines.find((l) => /error/i.test(l));
  return (pick ?? lines[0] ?? fallback).slice(0, 240);
}

export default function ProblemSolverPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const problemId = params.id;

  const [problem, setProblem] = useState<Problem | null>(null);
  const [language, setLanguage] = useState<LangKey>('python');
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<BottomTab>('tests');

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);

  const [split, setSplit] = useState(44);
  const dragging = useRef(false);

  const editorRef = useRef<CodeEditorHandle>(null);
  const editedRef = useRef(false);
  const [draft, setDraft] = useState<DraftState>('clean');
  const [editorError, setEditorError] = useState<EditorErrorMarker | null>(null);
  const [pendingLanguage, setPendingLanguage] = useState<LangKey | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Custom input: runs the solution on whatever the student types instead of a sample.
  const [customOpen, setCustomOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customRunning, setCustomRunning] = useState(false);

  // Visualiser: a trace is fetched alongside Run, then replayed in the drawer.
  const [vizOpen, setVizOpen] = useState(false);
  const [vizSeen, setVizSeen] = useState(false);
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [tracing, setTracing] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [traceKey, setTraceKey] = useState(0);
  const [traceCase, setTraceCase] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [vizLine, setVizLine] = useState<number | null>(null);
  const [vizWidth, setVizWidth] = useState(45);
  // What the current trace was taken from, so paging and the "code changed" notice stay honest.
  const traceMeta = useRef<{ code: string; lang: LangKey; caseIndex: number } | null>(null);
  const [traceCode, setTraceCode] = useState<{ code: string; lang: LangKey } | null>(null);
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
    setEditorError(null);
    setTraceCase(0);
    setTraceCode(null);
    traceMeta.current = null;
    setCustomInput('');
    editedRef.current = false;
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
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(draftKey(problem.id, language));
    } catch {
      // Storage can be blocked (private mode, policy); the starter still loads.
    }
    editedRef.current = false;
    setDraft(saved !== null ? 'saved' : 'clean');
    setCode(saved ?? problem.starterCode?.[language] ?? '');
  }, [problem, language]);

  const writeDraft = useCallback((id: string, lang: LangKey, text: string) => {
    try {
      window.localStorage.setItem(draftKey(id, lang), text);
      editedRef.current = false;
      setDraft('saved');
    } catch {
      setDraft('failed');
    }
  }, []);

  // Autosave, but only for edits the student made — loading a draft or the starter is not one.
  useEffect(() => {
    if (!problem || !editedRef.current) return;
    const timer = setTimeout(() => writeDraft(problem.id, language, code), 400);
    return () => clearTimeout(timer);
  }, [code, problem, language, writeDraft]);

  const handleEdit = useCallback((next: string) => {
    editedRef.current = true;
    setDraft('dirty');
    setEditorError(null);
    setCode(next);
  }, []);

  const starterFor = useCallback(
    (lang: LangKey) => problem?.starterCode?.[lang] ?? '',
    [problem],
  );

  /** Has the student written anything beyond the starter in the current language? */
  const hasWork = code.trim() !== '' && code.trim() !== starterFor(language).trim();

  const switchLanguage = useCallback(
    (next: LangKey) => {
      // Write the current draft now: the autosave timer would be cancelled by the switch.
      if (problem && editedRef.current) writeDraft(problem.id, language, code);
      setEditorError(null);
      setLanguage(next);
    },
    [problem, language, code, writeDraft],
  );

  const requestLanguage = useCallback(
    (next: LangKey) => {
      if (next === language) return;
      if (hasWork) setPendingLanguage(next);
      else switchLanguage(next);
    },
    [language, hasWork, switchLanguage],
  );

  const doReset = useCallback(() => {
    if (!problem) return;
    setCode(starterFor(language));
    try {
      window.localStorage.removeItem(draftKey(problem.id, language));
    } catch {
      // Nothing to remove if storage is unavailable.
    }
    editedRef.current = false;
    setDraft('clean');
    setEditorError(null);
  }, [problem, language, starterFor]);

  const draftExists = (lang: LangKey): boolean => {
    try {
      return !!problem && window.localStorage.getItem(draftKey(problem.id, lang)) !== null;
    } catch {
      return false;
    }
  };

  /**
   * Traces the solution against the first visible test case so the drawer has
   * something to replay. Runs alongside Run and never blocks it — a trace
   * failing is not a reason for Run to look broken.
   */
  const refreshTrace = useCallback(
    async (caseIndex?: number) => {
      if (!problem || problem.type !== 'PROGRAMMING' || !plan) return;
      const which = caseIndex ?? traceCase;
      setTraceCase(which);
      setTracing(true);
      setTraceError(null);
      const token = ++traceToken.current;
      try {
        const result = await api.post<TraceResult & { errorLine?: number | null }>('/execute/trace', {
          problemId: problem.id,
          code,
          lang: language,
          testCaseIndex: which,
        });
        // Ignore a reply that belongs to an older run or a different problem.
        if (token !== traceToken.current) return;
        traceMeta.current = { code, lang: language, caseIndex: which };
        setTraceCode({ code, lang: language });
        setTrace(result);
        setTraceKey((key) => key + 1);
        if (result.compileError && result.errorLine) {
          setEditorError({ line: result.errorLine, message: summarise(result.compileError, 'Compile error') });
        }
      } catch (error) {
        if (token !== traceToken.current) return;
        // Surfaced in the drawer rather than swallowed — a silent failure here
        // looks exactly like a broken visualiser.
        setTrace(null);
        setTraceError(error instanceof Error ? error.message : 'Could not trace this run');
      } finally {
        if (token === traceToken.current) setTracing(false);
      }
    },
    [problem, plan, code, language, traceCase],
  );

  /**
   * Fetches the next page of a long run. It re-runs the code the trace was
   * taken from — not whatever is in the editor now — so the pages line up.
   */
  const loadMoreTrace = useCallback(async () => {
    const meta = traceMeta.current;
    if (!problem || !trace || trace.nextOffset === null || !meta) return;
    const token = traceToken.current;
    setLoadingMore(true);
    try {
      const page = await api.post<TraceResult>('/execute/trace', {
        problemId: problem.id,
        code: meta.code,
        lang: meta.lang,
        testCaseIndex: meta.caseIndex,
        offset: trace.nextOffset,
      });
      if (token !== traceToken.current) return;
      setTrace((current) =>
        current
          ? {
              ...page,
              offset: current.offset,
              events: [...current.events, ...page.events],
            }
          : current,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load more steps');
    } finally {
      setLoadingMore(false);
    }
  }, [problem, trace]);

  const run = useCallback(async () => {
    if (!problem) return;
    setRunning(true);
    setTab('tests');
    setEditorError(null);
    void refreshTrace();
    try {
      const result = await api.post<EvaluationResult>('/execute/submit', {
        problemId: problem.id,
        code,
        lang: language,
        visibleOnly: true,
      });
      setEvaluation(result);
      if (result.errorLine) {
        const crashed = result.results.find((row) => !row.isHidden && row.stderr);
        setEditorError({
          line: result.errorLine,
          message: summarise(result.compileError ?? crashed?.stderr, 'Error'),
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not run your code');
    } finally {
      setRunning(false);
    }
  }, [problem, code, language, refreshTrace]);

  const runCustom = useCallback(async () => {
    if (!problem) return;
    setCustomRunning(true);
    setTab('console');
    setEditorError(null);
    try {
      const result = await api.post<RunResult>('/execute/run', {
        problemId: problem.id,
        code,
        lang: language,
        // Blank means "the first sample", which is what the server does with it.
        stdin: customInput,
      });
      setRunResult(result);
      if (result.errorLine) {
        setEditorError({
          line: result.errorLine,
          message: summarise(result.compileError ?? result.stderr, 'Error'),
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not run your code');
    } finally {
      setCustomRunning(false);
    }
  }, [problem, code, language, customInput]);

  const submit = useCallback(async () => {
    if (!problem) return;
    setSubmitting(true);
    setTab('tests');
    setEditorError(null);
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
        results: result.testResults.map((row, index) => ({ ...row, index })),
        passedCount: result.passedCount,
        totalCount: result.totalCount,
        totalMs: result.executionMs ?? 0,
      });

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
  const stale = trace !== null && traceCode !== null && (traceCode.code !== code || traceCode.lang !== language);
  const firstSample = problem.testCases?.find((testCase) => !testCase.isHidden)?.input ?? '';
  const languageLabel = (lang: LangKey) => LANGUAGES.find((entry) => entry.key === lang)!.label;

  return (
    <PageTransition>
      <div
        className="coding-workspace viz-dock flex h-[calc(100dvh-57px)] flex-col lg:flex-row"
        // Leave room for the docked visualiser so the editor stays visible beside it.
        style={{ '--viz-pad': vizOpen ? vizWidth : 0 } as CSSProperties}
      >
        {/* Left: the statement */}
        <section
          className="min-h-0 shrink-0 overflow-y-auto border-b border-line lg:border-r lg:border-b-0"
          style={{ width: undefined, flexBasis: isElectronics ? '46%' : `${split}%` }}
        >
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
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <Select
                  value={language}
                  onChange={(event) => requestLanguage(event.target.value as LangKey)}
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
                  title="Reset to the starter code"
                  onClick={() => (hasWork ? setConfirmReset(true) : doReset())}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  title="Tidy the indentation and spacing (⌘/Ctrl ⇧ F)"
                  onClick={() => editorRef.current?.format()}
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                  Format
                </Button>

                {draft !== 'clean' ? (
                  <span
                    role="status"
                    className={cn(
                      'flex items-center gap-1 font-mono text-[10.5px]',
                      draft === 'failed' ? 'text-fault' : 'text-faint',
                    )}
                    title={
                      draft === 'failed'
                        ? 'This browser blocked saving. Copy your code somewhere safe.'
                        : 'Drafts are kept in this browser, per problem and language.'
                    }
                  >
                    {draft === 'saved' ? (
                      <>
                        <Check className="h-3 w-3 text-trace" strokeWidth={2.2} />
                        Draft saved
                      </>
                    ) : draft === 'dirty' ? (
                      <>
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass-lit" />
                        Saving…
                      </>
                    ) : (
                      'Not saved'
                    )}
                  </span>
                ) : null}

                <div className="ml-auto flex items-center gap-2">
                  <span className="hidden font-mono text-[10px] text-faint xl:inline">
                    ⌘/Ctrl ↵ run · ⇧ ⌘/Ctrl ↵ submit
                  </span>
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
                  <Button
                    variant={customOpen ? 'brass' : 'ghost'}
                    size="sm"
                    title="Run your code on an input you type"
                    aria-pressed={customOpen}
                    onClick={() => {
                      setCustomOpen((open) => !open);
                      setCustomInput((value) => (value === '' ? firstSample : value));
                    }}
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                    Input
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void run()} loading={running}>
                    <Play className="h-3.5 w-3.5" />
                    Run
                  </Button>
                  <Button size="sm" onClick={() => void submit()} loading={submitting}>
                    <Send className="h-3.5 w-3.5" />
                    Submit
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1">
                <CodeEditor
                  ref={editorRef}
                  language={language}
                  value={code}
                  onChange={handleEdit}
                  onRun={() => void run()}
                  onSubmit={() => void submit()}
                  highlightLine={vizOpen ? vizLine : null}
                  error={editorError}
                />
              </div>

              {customOpen ? (
                <div className="border-t border-line bg-ink-sunken/40 px-3 py-2.5">
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="instrument">Custom input</span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
                      One JSON value per line
                      {plan?.paramNames.length ? `, in order: ${plan.paramNames.join(', ')}` : ''}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void runCustom()}
                      loading={customRunning}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Run input
                    </Button>
                  </div>
                  <Textarea
                    value={customInput}
                    onChange={(event) => setCustomInput(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        event.preventDefault();
                        void runCustom();
                      }
                    }}
                    rows={Math.min(5, Math.max(2, customInput.split('\n').length))}
                    spellCheck={false}
                    aria-label="Custom input"
                    placeholder={firstSample || 'Type an input'}
                    className="font-mono text-[12px] leading-relaxed"
                  />
                  <p className="mt-1 text-[11px] text-faint">
                    Output appears in the Console tab. Leave it blank to use the first sample.
                  </p>
                </div>
              ) : null}

              <div className="flex h-[38%] min-h-[180px] flex-col border-t border-line">
                <div className="flex items-center gap-1 border-b border-line px-2">
                  {(
                    [
                      { value: 'tests', label: 'Test results', icon: TestTube2 },
                      { value: 'console', label: 'Console', icon: Terminal },
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
                      cases={problem.testCases?.filter((c) => !c.isHidden)}
                    />
                  ) : tab === 'console' ? (
                    <ConsoleOutput
                      result={runResult}
                      running={running || customRunning}
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

      {plan ? (
        <VizDrawer
          open={vizOpen}
          onClose={() => setVizOpen(false)}
          problem={problem}
          plan={plan}
          trace={trace}
          traceKey={traceKey}
          loading={tracing}
          error={traceError}
          caseIndex={traceCase}
          onCaseChange={(index) => void refreshTrace(index)}
          onLoadMore={loadMoreTrace}
          loadingMore={loadingMore}
          stale={stale}
          onLineChange={setVizLine}
          onWidthChange={setVizWidth}
        />
      ) : null}

      <Modal
        open={pendingLanguage !== null}
        onClose={() => setPendingLanguage(null)}
        label="Switch language"
        title={pendingLanguage ? `Switch to ${languageLabel(pendingLanguage)}?` : ''}
        description="The editor shows one language at a time."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPendingLanguage(null)}>
              Stay on {languageLabel(language)}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (pendingLanguage) switchLanguage(pendingLanguage);
                setPendingLanguage(null);
              }}
            >
              Switch language
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-paper">
          Your {languageLabel(language)} code is saved as a draft for this problem and will be here
          when you switch back. It is not carried across: the editor will show{' '}
          {pendingLanguage && draftExists(pendingLanguage)
            ? `your saved ${languageLabel(pendingLanguage)} draft`
            : pendingLanguage
              ? `the ${languageLabel(pendingLanguage)} starter code`
              : 'the other language'}
          .
        </p>
      </Modal>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        label="Reset"
        title="Reset to the starter code?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
              Keep my code
            </Button>
            <Button
              size="sm"
              onClick={() => {
                doReset();
                setConfirmReset(false);
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-paper">
          This replaces your {languageLabel(language)} code and deletes its saved draft. It cannot be
          undone.
        </p>
      </Modal>
    </PageTransition>
  );
}
