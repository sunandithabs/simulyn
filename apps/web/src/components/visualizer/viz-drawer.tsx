'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Problem } from '@/lib/types';
import { cn } from '@/lib/utils';

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
import type { RendererProps, TraceResult, VisualizerKind, VisualizerPlan } from './types';
import { VariableInspector } from './variable-inspector';

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
  loading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  problem: Problem;
  plan: VisualizerPlan;
  trace: TraceResult | null;
  loading: boolean;
  /** Why the trace request itself failed, if it did. */
  error?: string | null;
}) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [width, setWidth] = useState(45);
  const dragging = useRef(false);

  const events = trace?.events ?? [];
  const total = events.length;
  const current = total > 0 ? events[Math.min(step, total - 1)] : null;
  const previous = step > 0 ? events[step - 1] : null;

  // A fresh trace restarts the transport.
  useEffect(() => {
    setStep(0);
    setPlaying(total > 1);
  }, [trace, total]);

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
    if (!playing && step >= total - 1) setStep(0);
    setPlaying((value) => !value);
  }, [playing, step, total]);

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
          'fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
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
              {trace?.truncated ? <Badge tone="warn">truncated at 5000</Badge> : null}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close the visualiser">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="px-5 pt-3 text-[12.5px] text-muted">{plan.why}</p>

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
                <Renderer kind={plan.kind} event={current} previous={previous} plan={plan} problem={problem} />
              </div>

              {plan.secondary ? (
                <div className="h-[220px] w-full border-b border-line">
                  <Renderer
                    kind={plan.secondary}
                    event={current}
                    previous={previous}
                    plan={{ ...plan, kind: plan.secondary }}
                    problem={problem}
                  />
                </div>
              ) : null}

              <div className="px-5 py-3">
                <span className="instrument">This step</span>
                <p className="mt-1.5 min-h-[2.4em] font-mono text-[12px] break-words text-paper">
                  {loading
                    ? 'tracing…'
                    : current
                      ? current.description
                      : 'Press Run to trace your solution.'}
                </p>
              </div>

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

              <div className="border-t border-line">
                <VariableInspector event={current} previous={previous} />
              </div>
            </>
          )}
        </div>

        {!isCircuit ? (
          <PlaybackControls
            step={step}
            total={total}
            playing={playing}
            speed={speed}
            disabled={loading || total <= 1}
            onPlayPause={togglePlay}
            onSeek={seek}
            onSpeed={setSpeed}
          />
        ) : null}
      </aside>
    </>
  );
}
