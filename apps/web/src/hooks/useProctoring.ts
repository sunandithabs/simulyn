'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { FLAG_THRESHOLD } from '@simulyn/shared';

import { detectExtendedDisplay } from '@/lib/display';
import { createProctoringSocket, type Socket } from '@/lib/socket';
import type { ViolationTypeKey } from '@/lib/types';

/** Repeat detections of the same kind inside this window are ignored. */
const COOLDOWN_MS = 3000;
const HEARTBEAT_MS = 5000;
/** Chrome opens devtools by shrinking the viewport inside the window frame. */
const DEVTOOLS_GAP = 170;
/** How often the display layout is re-checked on browsers without an event. */
const DISPLAY_POLL_MS = 15_000;
/** How many recent in-exam copies stay pasteable. */
const CLIPBOARD_HISTORY = 25;

export { FLAG_THRESHOLD };

export interface TerminationNotice {
  attemptId: string;
  reason: string;
  /** Proctor's username, or null when the violation threshold did it. */
  by: string | null;
  violationCount: number;
  at: string;
}

export interface ProctoringState {
  connected: boolean;
  violationCount: number;
  integrityScore: number;
  lastAlert: { typeKey: ViolationTypeKey; message: string; at: number } | null;
}

export interface ProctoringOptions {
  examId: string;
  attemptId: string | null;
  /** Pauses every detector — used before the paper opens and after submit. */
  enabled: boolean;
  /**
   * Restricts pasting to content copied from inside the exam itself, so a
   * student can lift a test case out of the problem brief but cannot paste a
   * solution in from another window. Off outside an exam, where the clipboard
   * is nobody's business.
   */
  restrictClipboard?: boolean;
  /** Current editor contents, captured with each violation. */
  getSnapshot?: () => string;
  getCurrentQuestion?: () => number;
  getTimeRemaining?: () => number;
  onExamEnded?: () => void;
  /** The student has been removed from the exam. */
  onTerminated?: (notice: TerminationNotice) => void;
}

/**
 * Watches for the behaviours an invigilator would notice and reports them over
 * the proctoring socket, plus a five-second heartbeat so the teacher's grid can
 * tell "thinking" from "gone".
 *
 * Every detector is a heuristic, and the student is told what was recorded —
 * nothing here is silent.
 */
export function useProctoring({
  examId,
  attemptId,
  enabled,
  restrictClipboard = false,
  getSnapshot,
  getCurrentQuestion,
  getTimeRemaining,
  onExamEnded,
  onTerminated,
}: ProctoringOptions): ProctoringState {
  const [connected, setConnected] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [lastAlert, setLastAlert] = useState<ProctoringState['lastAlert']>(null);

  const socketRef = useRef<Socket | null>(null);
  const lastByType = useRef<Map<string, number>>(new Map());
  /**
   * Text copied from inside the exam this session. Insertion-ordered, so the
   * oldest entry is the one evicted once it is full. Never leaves the page.
   */
  const internalClips = useRef<Set<string>>(new Set());
  /** Last known extended-display state, so we report transitions not ticks. */
  const extendedDisplay = useRef(false);
  const attemptRef = useRef(attemptId);
  attemptRef.current = attemptId;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const report = useCallback(
    (typeKey: ViolationTypeKey, message: string, metadata?: Record<string, unknown>) => {
      if (!enabledRef.current || !attemptRef.current) return;

      const now = Date.now();
      const previous = lastByType.current.get(typeKey) ?? 0;
      if (now - previous < COOLDOWN_MS) return;
      lastByType.current.set(typeKey, now);

      setLastAlert({ typeKey, message, at: now });

      socketRef.current?.emit(
        'violation',
        {
          examAttemptId: attemptRef.current,
          typeKey,
          codeSnapshot: getSnapshot?.().slice(0, 20_000),
          timeRemaining: getTimeRemaining?.(),
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
        (ack: { ok: boolean; integrityScore?: number; violationCount?: number }) => {
          if (!ack?.ok) return;
          if (typeof ack.integrityScore === 'number') setIntegrityScore(ack.integrityScore);
          if (typeof ack.violationCount === 'number') setViolationCount(ack.violationCount);
        },
      );
    },
    [getSnapshot, getTimeRemaining],
  );

  // ── socket lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !attemptId) return;

    const socket = createProctoringSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-exam', { examId, attemptId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('exam-ended', () => onExamEnded?.());

    // Only ever delivered to this student's own attempt room.
    socket.on('student-terminated', (event: TerminationNotice) => {
      if (event.attemptId !== attemptId) return;
      onTerminated?.(event);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, attemptId, examId, onExamEnded, onTerminated]);

  // ── heartbeat ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !attemptId) return;

    const send = () =>
      socketRef.current?.emit('heartbeat', {
        examAttemptId: attemptId,
        currentQuestion: getCurrentQuestion?.(),
        timeRemaining: getTimeRemaining?.(),
      });

    send();
    const timer = setInterval(send, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [enabled, attemptId, getCurrentQuestion, getTimeRemaining]);

  // ── detectors ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !attemptId) return;

    /**
     * Copying inside the exam is allowed and never logged — a student lifting a
     * test case out of the problem brief is doing normal work. What each copy
     * does is register the text as pasteable, so the paste handler can tell
     * "moved this from the brief into the editor" from "brought this in from
     * somewhere else".
     */
    const remember = (event: ClipboardEvent) => {
      if (!restrictClipboard) return;
      const text =
        event.clipboardData?.getData('text/plain') || (document.getSelection()?.toString() ?? '');
      const trimmed = text.trim();
      if (!trimmed) return;

      internalClips.current.add(trimmed);
      // Bounded: only the most recent copies stay pasteable.
      if (internalClips.current.size > CLIPBOARD_HISTORY) {
        internalClips.current.delete(internalClips.current.values().next().value as string);
      }
    };

    /**
     * A paste of something copied inside the exam goes through untouched. A
     * paste of anything else is cancelled and recorded — otherwise a student can
     * paste in a whole solution and take the ten-point hit as the price.
     */
    const onPaste = (event: ClipboardEvent) => {
      if (!restrictClipboard) return;

      const pasted = (event.clipboardData?.getData('text/plain') ?? '').trim();
      // Nothing to police: an empty or non-text paste changes no code.
      if (!pasted) return;
      if (internalClips.current.has(pasted)) return;

      event.preventDefault();
      report('PASTE', 'Only content copied from inside this exam can be pasted.');
    };
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      report('RIGHTCLICK', 'The context menu is disabled during the exam.');
    };
    const onVisibility = () => {
      if (document.hidden) report('TABSWITCH', 'You left the exam tab.');
    };
    const onBlur = () => report('BLUR', 'The exam window lost focus.');
    const onFullscreen = () => {
      if (!document.fullscreenElement) report('FULLSCREEN', 'You exited fullscreen.');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'PrintScreen') {
        report('SCREENSHOT', 'Screenshots are not permitted during the exam.');
        return;
      }

      // Ctrl/Cmd+R and F5 reload the paper; the browser owns the actual reload.
      if (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && event.key === 'r')) {
        report('REFRESH', 'Reloading the exam page is logged.');
        return;
      }

      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;

      // The usual routes into developer tools. Cancelling these only stops the
      // shortcut — the menu still works, which is why the size heuristic in
      // onResize stays as the backstop.
      const devtoolsCombo =
        event.key === 'F12' ||
        (modifier && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
        (modifier && key === 'u');

      if (devtoolsCombo) {
        event.preventDefault();
        report('DEVTOOLS', 'Developer tools are not allowed during the exam.', { key: event.key });
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      report('CLOSE', 'Closing the exam before submitting is logged.');
      event.preventDefault();
      event.returnValue = '';
    };
    const onResize = () => {
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      if (widthGap > DEVTOOLS_GAP || heightGap > DEVTOOLS_GAP) {
        report('DEVTOOLS', 'Developer tools appear to be open.', { widthGap, heightGap });
      }
    };

    document.addEventListener('copy', remember);
    document.addEventListener('cut', remember);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('resize', onResize);

    /**
     * A second display is a *state*, not an event: report it when the student
     * enters that state and again if they leave and re-enter, but never on a
     * loop while it simply stays true.
     */
    const checkDisplays = () => {
      const reason = detectExtendedDisplay();
      const extended = reason !== null;

      if (extended && !extendedDisplay.current) {
        report('MULTIMONITOR', 'A second display was detected.', { reason });
      }
      extendedDisplay.current = extended;
    };

    // Chromium fires this when a monitor is plugged in or unplugged mid-exam.
    const screenTarget = window.screen as unknown as EventTarget;
    screenTarget.addEventListener?.('change', checkDisplays);
    const displayTimer = setInterval(checkDisplays, DISPLAY_POLL_MS);

    onResize();
    checkDisplays();

    return () => {
      clearInterval(displayTimer);
      screenTarget.removeEventListener?.('change', checkDisplays);
      document.removeEventListener('copy', remember);
      document.removeEventListener('cut', remember);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('resize', onResize);
    };
  }, [enabled, attemptId, report, restrictClipboard]);

  return { connected, violationCount, integrityScore, lastAlert };
}
