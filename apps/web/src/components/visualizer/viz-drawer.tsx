'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Problem } from '@/lib/types';
import { cn } from '@/lib/utils';

import { CallStack } from './call-stack';
import { CircuitView } from './circuit/circuit-view';
import { buildSchematic } from './circuit/templates';
import { WaveformView } from './circuit/waveform-view';
import { PlaybackControls, type Speed } from './playback-controls';
import { ArrayView } from './renderers/array-view';
import { LinkedListView } from './renderers/linked-list-view';
import { MatrixView } from './renderers/matrix-view';
import { StackView } from './renderers/stack-view';
import { TreeView } from './renderers/tree-view';
import { labelFor } from './resolve';
import { changeFlags, nextChange, stackAt } from './stack';
import type { RendererProps, TraceResult, VisualizerKind, VisualizerPlan } from './types';
import { VariableInspector } from './variable-inspector';

const EMPTY: never[] = [];
const MIN_WIDTH = 30;
const MAX_WIDTH = 80;

function Renderer({ kind, ...props }: RendererProps & { kind: VisualizerKind }) {
  switch (kind) {
    case 'linkedList':
      return <LinkedListView {...props} />;
    case 'tree':
      return <TreeView {...props} />;
    case 'stack':
      return <StackView {...props} />;
    case 'matrix':
    case 'grid':
      return <MatrixView {...props} />;
    default:
      return <ArrayView {...props} />;
  }
}

/**
 * Right-hand overlay that replays a traced run.
 *
 * Slides in with a CSS transform, closes on Escape or a backdrop click, and is
 * resizable by dragging its left edge. Deliberately not mounted on the exam
 * page — this is a learning aid.
 */
export function VizDrawer({
  open,
  onClose,
  problem,
  plan,
  trace,
  traceKey,
  loading,
  error,
  caseIndex,
  onCaseChange,
  onLoadMore,
  loadingMore,
  stale,
  onLineChange,
  onWidthChange,
}: {
  open: boolean;
  onClose: () => void;
  problem: Problem;
  plan: VisualizerPlan;
  trace: TraceResult | null;
  loading: boolean;
  /** Changes only when a fresh trace arrives, so appending a page does not restart playback. */
  traceKey: number;
  /** Why the trace request itself failed, if it did. */
  error?: string | null;
  /** Which visible sample case is being traced. */
  caseIndex: number;
  onCaseChange: (index: number) => void;
  /** Fetches the next page of a long run and appends it. */
  onLoadMore: () => Promise<void>;
  loadingMore: boolean;
  /** The code has been edited since this trace was taken. */
  stale: boolean;
  /** The source line of the current step, for the editor to highlight. */
  onLineChange?: (line: number | null) => void;
  /** Reported so the page can leave room for the drawer instead of hiding the editor under it. */
  onWidthChange?: (percentage: number) => void;
}) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [width, setWidth] = useState(45);
  const dragging = useRef(false);

  const events = useMemo(() => trace?.events ?? EMPTY, [trace]);
  const total = events.length;
  const index = Math.min(step, Math.max(total - 1, 0));
  const current = total > 0 ? events[index] : null;
  const previous = index > 0 ? events[index - 1] : null;

  const frames = useMemo(() => stackAt(events, index), [events, index]);
  const flags = useMemo(() => changeFlags(events), [events]);
  const canJumpBack = nextChange(flags, index, -1) !== null;
  const canJumpForward = nextChange(flags, index, 1) !== null;
  const more = trace?.truncated === true && trace.nextOffset !== null;
  const lastStep = total > 0 ? events[total - 1].step : 0;

  const visibleCases = useMemo(
    () => (problem.testCases ?? []).filter((testCase) => !testCase.isHidden),
    [problem.testCases],
  );
  const traced = visibleCases[Math.min(caseIndex, Math.max(visibleCases.length - 1, 0))];

  // A fresh trace restarts the transport. Appending a page deliberately does not.
  useEffect(() => {
    setStep(0);
    setPlaying(total > 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traceKey]);

  // The editor highlights whichever line this step is on, unless the code has moved on.
  const line = open && !stale ? (current?.line ?? null) : null;
  useEffect(() => {
    onLineChange?.(line);
  }, [line, onLineChange]);
  useEffect(() => () => onLineChange?.(null), [onLineChange]);

  useEffect(() => {
    onWidthChange?.(width);
  }, [width, onWidthChange]);

  useEffect(() => {
    if (!open) setPlaying(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Playback clock.
  useEffect(() => {
    if (!playing || total === 0) return;
    const timer = setInterval(() => {
      setStep((value) => {
        if (value >= total - 1) {
          setPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 700 / speed);
    return () => clearInterval(timer);
  }, [playing, speed, total]);

  // Drag to resize from the left edge.
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      const percentage = ((window.innerWidth - event.clientX) / window.innerWidth) * 100;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, percentage)));
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

  const jumpChange = useCallback(
    (direction: -1 | 1) => {
      const target = nextChange(flags, index, direction);
      if (target !== null) {
        setPlaying(false);
        setStep(target);
      }
    },
    [flags, index],
  );

  const loadMore = useCallback(async () => {
    const before = total;
    await onLoadMore();
    // Carry on from where the first page stopped.
    setStep(before);
    setPlaying(true);
  }, [onLoadMore, total]);

  const seek = useCallback(
    (next: number) => {
      setPlaying(false);
      setStep(Math.min(Math.max(next, 0), Math.max(total - 1, 0)));
    },
    [total],
  );

  /**
   * Play from the top when the trace has already finished. Without this,
   * pressing Play at the last step immediately re-pauses and looks broken —
   * which is exactly what happens after the auto-play on arrival.
   */
  const togglePlay = useCallback(() => {
    if (!playing && step >= total - 1) {
      if (more) {
        void loadMore();
        return;
      }
      setStep(0);
    }
    setPlaying((value) => !value);
  }, [playing, step, total, more, loadMore]);

  // Arrow keys step, [ and ] jump between changes. Ignored while typing, so the
  // editor keeps its own keys.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'ArrowRight') seek(index + 1);
      else if (event.key === 'ArrowLeft') seek(index - 1);
      else if (event.key === ']') jumpChange(1);
      else if (event.key === '[') jumpChange(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, seek, jumpChange]);

  /**
   * A trace this short means the function returned without doing anything —
   * almost always the untouched starter code, whose body is `pass`.
   */
  const trivial = trace !== null && !trace.compileError && total > 0 && total <= 2;

  const isCircuit = plan.kind === 'circuit';
  const schematic = isCircuit ? buildSchematic(problem.category, problem.params) : null;

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          // Below lg the drawer covers the screen, so it dims it. From lg up it docks
          // beside the editor, which has to stay sharp and clickable.
          'fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        role="dialog"
        aria-label={`Visualisation of ${problem.title}`}
        className={cn(
          'viz-drawer fixed inset-y-0 right-0 z-50 flex flex-col border-l border-line bg-ink-raised shadow-2xl',
          open ? 'viz-drawer-open' : '',
        )}
        style={{ width: `min(100vw, ${width}%)` }}
      >
        <div
          onPointerDown={() => {
            dragging.current = true;
            document.body.style.userSelect = 'none';
          }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the visualisation"
          className="absolute inset-y-0 left-0 hidden w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-violet-lit/50 lg:block"
        />

        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <span className="instrument">Visualiser</span>
            <h2 className="mt-1 truncate text-[15px] font-semibold tracking-[-0.01em] text-paper">
              {problem.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="violet">{labelFor(plan.kind)}</Badge>
              {plan.secondary ? <Badge>{labelFor(plan.secondary)}</Badge> : null}
              {trace?.fidelity === 'manual' ? <Badge tone="warn">manual steps only</Badge> : null}
              {more ? <Badge tone="warn">more steps available</Badge> : null}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close the visualiser">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="px-5 pt-3 text-[12.5px] text-muted">{plan.why}</p>
          {!isCircuit ? (
            <div className="mx-5 mt-3 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
              <span className="instrument">Tracing {problem.title}</span>
              {visibleCases.length > 1 ? (
                <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Sample case to trace">
                  {visibleCases.map((testCase, i) => (
                    <button
                      key={testCase.id}
                      onClick={() => i !== caseIndex && onCaseChange(i)}
                      aria-pressed={i === caseIndex}
                      disabled={loading}
                      className={cn(
                        'rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors',
                        i === caseIndex
                          ? 'border-violet-lit/60 bg-violet/25 text-paper'
                          : 'border-line text-muted hover:text-paper',
                      )}
                    >
                      Case {i + 1}
                    </button>
                  ))}
                </div>
              ) : null}
              <pre className="mt-1 font-mono text-[11.5px] whitespace-pre-wrap text-paper">
                {traced?.input ?? 'first sample case'}
              </pre>
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                <span>
                  <span className="text-trace">■</span> value that changed
                </span>
                <span>
                  <span className="text-violet-lit">■</span> cell being used
                </span>
                <span>
                  <span className="text-brass-lit">▼</span> pointer / index variable
                </span>
              </p>
            </div>
          ) : null}

          {isCircuit ? (
            <>
              <CircuitView
                category={problem.category}
                params={problem.params}
                className="mt-2 h-[320px] w-full"
              />
              {schematic?.waveform ? (
                <div className="border-t border-line">
                  <WaveformView
                    kind={schematic.waveform}
                    params={problem.params}
                    className="block h-[170px] w-full"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="mt-2 h-[260px] w-full border-b border-line">
                <Renderer
                  kind={plan.kind}
                  event={current}
                  previous={previous}
                  plan={plan}
                  problem={problem}
                  frames={frames}
                />
              </div>

              {plan.secondary ? (
                <div className="h-[220px] w-full border-b border-line">
                  <Renderer
                    kind={plan.secondary}
                    event={current}
                    previous={previous}
                    plan={{ ...plan, kind: plan.secondary }}
                    problem={problem}
                    frames={frames}
                  />
                </div>
              ) : null}

              <div className="px-5 py-3">
                <span className="instrument">
                  This step{current ? ` · ${current.step} of ${lastStep}${more ? '+' : ''}` : ''}
                </span>
                <p className="mt-1.5 min-h-[2.4em] font-mono text-[12px] break-words text-paper">
                  {loading
                    ? 'tracing…'
                    : current
                      ? current.description
                      : 'Press Run to trace your solution.'}
                </p>
              </div>

              {stale && total > 0 ? (
                <p className="mx-5 mb-3 rounded-lg border border-brass/30 bg-brass/[0.07] px-3 py-2 text-[12px] text-brass-lit">
                  Your code has changed since this trace. Press Run to trace it again.
                </p>
              ) : null}

              {more ? (
                <div className="mx-5 mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
                  <p className="min-w-0 flex-1 text-[12px] text-muted">
                    Showing steps 1–{lastStep}. The run goes on past that.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => void loadMore()} loading={loadingMore}>
                    Load the next 5000 steps
                  </Button>
                </div>
              ) : null}

              {trivial ? (
                <div className="mx-5 mb-4 rounded-lg border border-brass/30 bg-brass/[0.07] px-3.5 py-3">
                  <p className="text-[13px] text-brass-lit">
                    Your solution ran in {total} step{total === 1 ? '' : 's'}, so there is almost
                    nothing to animate.
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                    If you are still on the starter code, write your solution and press{' '}
                    <span className="text-paper">Run</span> — the trace follows every line as it
                    executes.
                  </p>
                </div>
              ) : null}

              {trace && !trace.ok && trace.stderr ? (
                <div className="mx-5 mb-4 rounded-lg border border-fault/30 bg-fault/[0.06] px-3.5 py-3">
                  <p className="text-[13px] text-fault">Your code raised an error while tracing.</p>
                  <pre className="mt-1.5 font-mono text-[11px] whitespace-pre-wrap text-fault">
                    {trace.stderr.split('\n').slice(-4).join('\n')}
                  </pre>
                </div>
              ) : null}

              {error ? (
                <div className="mx-5 mb-4 flex items-start gap-2 rounded-lg border border-fault/30 bg-fault/[0.06] px-3 py-2.5">
                  <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-fault" />
                  <span className="text-[12.5px] text-fault">{error}</span>
                </div>
              ) : null}

              {trace?.compileError ? (
                <div className="mx-5 mb-4 flex items-start gap-2 rounded-lg border border-fault/30 bg-fault/[0.06] px-3 py-2.5">
                  <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-fault" />
                  <pre className="font-mono text-[11px] whitespace-pre-wrap text-fault">
                    {trace.compileError}
                  </pre>
                </div>
              ) : null}

              {trace && trace.fidelity !== 'full' && total > 0 ? (
                <p className="mx-5 mb-4 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-[12px] text-muted">
                  {trace.fidelity === 'partial'
                    ? 'JavaScript reports array reads and writes rather than every line. Run in Python for a step-by-step trace.'
                    : 'Compiled languages only report what your code emits itself. Run in Python for a step-by-step trace.'}
                </p>
              ) : null}

              <CallStack frames={frames} />

              <div className="border-t border-line">
                <VariableInspector event={current} previous={previous} />
              </div>
            </>
          )}
        </div>

        {!isCircuit ? (
          <PlaybackControls
            step={index}
            total={total}
            playing={playing}
            speed={speed}
            disabled={loading || total <= 1}
            onPlayPause={togglePlay}
            onSeek={seek}
            onSpeed={setSpeed}
            stepLabel={current ? `${current.step} / ${lastStep}${more ? '+' : ''}` : undefined}
            canJumpBack={canJumpBack}
            canJumpForward={canJumpForward}
            onJumpChange={jumpChange}
          />
        ) : null}
      </aside>
    </>
  );
}
