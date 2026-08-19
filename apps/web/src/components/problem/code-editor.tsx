'use client';

import Editor, { loader, type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useRef } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
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

function defineTheme(monaco: Monaco) {
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
}: {
  language: LangKey;
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  onSubmit?: () => void;
  readOnly?: boolean;
}) {
  // Handlers are kept in refs so the Monaco commands never capture stale state.
  const runRef = useRef(onRun);
  const submitRef = useRef(onSubmit);
  runRef.current = onRun;
  submitRef.current = onSubmit;

  return (
    <Editor
      language={MONACO_LANGUAGE[language]}
      theme={THEME_NAME}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      beforeMount={defineTheme}
      onMount={(instance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
        instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current?.());
        instance.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
          () => submitRef.current?.(),
        );
      }}
      loading={<Skeleton className="h-full w-full rounded-none" />}
      options={{
        readOnly,
        fontSize: 13.5,
        fontFamily: 'var(--font-jetbrains), ui-monospace, monospace',
        fontLigatures: true,
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
      }}
    />
  );
}
