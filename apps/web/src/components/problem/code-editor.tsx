'use client';

import Editor, { loader, type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/hooks/useTheme';
import { formatCode } from '@/lib/format';
import { isMidnight } from '@/lib/themes';
import type { LangKey } from '@/lib/types';

// Load Monaco from this server rather than a CDN — the deployment target may
// have no outbound internet. scripts/copy-monaco.mjs puts the assets in place.
const MONACO_BASE = '/monaco';

loader.config({ paths: { vs: `${MONACO_BASE}/vs` } });

/**
 * Monaco's language services run in web workers, and a worker has no document
 * to resolve relative URLs against — `fetch('/monaco/vs/…')` inside one throws
 * "Failed to parse URL". So we hand Monaco a tiny bootstrap worker that sets an
 * absolute baseUrl first, then loads Monaco's real worker entry point.
 */
if (typeof window !== 'undefined') {
  let workerUrl: string | null = null;

  (window as Window & { MonacoEnvironment?: unknown }).MonacoEnvironment = {
    getWorkerUrl(): string {
      if (workerUrl) return workerUrl;

      const origin = window.location.origin;
      const bootstrap = [
        `self.MonacoEnvironment = { baseUrl: '${origin}${MONACO_BASE}/' };`,
        `importScripts('${origin}${MONACO_BASE}/vs/base/worker/workerMain.js');`,
      ].join('\n');

      // Cached: Monaco spins up one worker per language service, and each call
      // would otherwise leak another object URL.
      workerUrl = URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' }));
      return workerUrl;
    },
  };
}

const MONACO_LANGUAGE: Record<LangKey, string> = {
  python: 'python',
  javascript: 'javascript',
  cpp: 'cpp',
  java: 'java',
};

export const THEME_NAME = 'simulyn-bench';
const MIDNIGHT_THEME = 'simulyn-midnight';

function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme(MIDNIGHT_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b6b80', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'a78bfa' },
      { token: 'string', foreground: 'd8b4fe' },
      { token: 'number', foreground: 'f5f5f5' },
      { token: 'type', foreground: 'c4b5fd' },
      { token: 'function', foreground: 'ffffff' },
    ],
    colors: {
      'editor.background': '#000000',
      'editor.foreground': '#f5f5f5',
      'editorLineNumber.foreground': '#3f3f55',
      'editorLineNumber.activeForeground': '#a78bfa',
      'editor.selectionBackground': '#7c3aed55',
      'editor.lineHighlightBackground': '#ffffff08',
      'editorCursor.foreground': '#a78bfa',
      'editorIndentGuide.background1': '#ffffff0d',
      'editorWidget.background': '#0a0a10',
      'editorWidget.border': '#ffffff1f',
      'scrollbarSlider.background': '#2a2a4088',
    },
  });

  monaco.editor.defineTheme(THEME_NAME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5a5a75', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'a78bfa' },
      { token: 'string', foreground: 'e8cc80' },
      { token: 'number', foreground: '4ade80' },
      { token: 'type', foreground: '7dd3fc' },
      { token: 'function', foreground: 'e9e9f2' },
    ],
    colors: {
      'editor.background': '#07070f',
      'editor.foreground': '#e9e9f2',
      'editorLineNumber.foreground': '#3a3a52',
      'editorLineNumber.activeForeground': '#8b8ba7',
      'editor.selectionBackground': '#7352b855',
      'editor.lineHighlightBackground': '#ffffff08',
      'editorCursor.foreground': '#e8cc80',
      'editorIndentGuide.background1': '#ffffff0d',
      'editorWidget.background': '#11111f',
      'editorWidget.border': '#ffffff1f',
      'scrollbarSlider.background': '#2a2a4088',
    },
  });
}

export function CodeEditor({
  language,
  value,
  onChange,
  onRun,
  onSubmit,
  readOnly,
  activeLine,
  errorLine,
  errorMessage,
  onReady,
}: {
  language: LangKey;
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  onSubmit?: () => void;
  readOnly?: boolean;
  /** Line the visualiser is on, highlighted while replaying a trace. */
  activeLine?: number | null;
  /** Line a compile or runtime error points at. */
  errorLine?: number | null;
  errorMessage?: string;
  /** Hands the parent actions that need the live editor. */
  onReady?: (api: { format: () => void }) => void;
}) {
  // Handlers are kept in refs so the Monaco commands never capture stale state.
  const runRef = useRef(onRun);
  const submitRef = useRef(onSubmit);
  runRef.current = onRun;
  submitRef.current = onSubmit;

  const instance = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const activeDecor = useRef<editor.IEditorDecorationsCollection | null>(null);
  const [ready, setReady] = useState(false);
  const { themeId } = useTheme();

  useEffect(() => {
    const ed = instance.current;
    const monaco = monacoRef.current;
    if (!ready || !ed || !monaco) return;
    onReady?.({
      format: () => {
        if (language === 'javascript') {
          void ed.getAction('editor.action.formatDocument')?.run();
          return;
        }
        const model = ed.getModel();
        if (!model) return;
        const next = formatCode(language, model.getValue());
        if (next !== model.getValue()) {
          ed.executeEdits('format', [{ range: model.getFullModelRange(), text: next }]);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, language]);

  useEffect(() => {
    const ed = instance.current;
    const monaco = monacoRef.current;
    if (!ready || !ed || !monaco || !activeDecor.current) return;
    if (activeLine && activeLine > 0) {
      activeDecor.current.set([
        {
          range: new monaco.Range(activeLine, 1, activeLine, 1),
          options: { isWholeLine: true, className: 'sim-active-line' },
        },
      ]);
      ed.revealLineInCenterIfOutsideViewport(activeLine);
    } else {
      activeDecor.current.set([]);
    }
  }, [activeLine, ready]);

  useEffect(() => {
    const ed = instance.current;
    const monaco = monacoRef.current;
    const model = ed?.getModel();
    if (!ready || !monaco || !model) return;
    const line = errorLine && errorLine <= model.getLineCount() ? errorLine : null;
    monaco.editor.setModelMarkers(
      model,
      'simulyn',
      line
        ? [
            {
              severity: monaco.MarkerSeverity.Error,
              message: errorMessage || 'Error on this line',
              startLineNumber: line,
              endLineNumber: line,
              startColumn: 1,
              endColumn: model.getLineMaxColumn(line),
            },
          ]
        : [],
    );
  }, [errorLine, errorMessage, ready]);

  return (
    <Editor
      language={MONACO_LANGUAGE[language]}
      theme={isMidnight(themeId) ? MIDNIGHT_THEME : THEME_NAME}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      beforeMount={defineTheme}
      onMount={(mounted: editor.IStandaloneCodeEditor, monaco: Monaco) => {
        instance.current = mounted;
        monacoRef.current = monaco;
        activeDecor.current = mounted.createDecorationsCollection([]);
        mounted.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current?.());
        mounted.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
          () => submitRef.current?.(),
        );
        setReady(true);
      }}
      loading={<Skeleton className="h-full w-full rounded-none" />}
      options={{
        readOnly,
        fontSize: 13.5,
        fontFamily: 'var(--font-jetbrains), ui-monospace, monospace',
        fontLigatures: '"calt" 1, "liga" 1',
        lineHeight: 1.65,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        padding: { top: 14, bottom: 14 },
        renderLineHighlight: 'line',
        tabSize: 4,
        automaticLayout: true,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        overviewRulerLanes: 0,
        bracketPairColorization: { enabled: true },
        cursorSmoothCaretAnimation: 'on',
        guides: { bracketPairs: true },
        glyphMargin: false,
      }}
    />
  );
}
