'use client';

import Editor, { loader, type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatCode } from '@/lib/format-code';
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

export interface CodeEditorHandle {
  /** Re-lays out the code. Goes through the editor, so Undo brings the old layout back. */
  format: () => void;
}

export interface EditorErrorMarker {
  line: number;
  message: string;
}

export const CodeEditor = forwardRef<
  CodeEditorHandle,
  {
    language: LangKey;
    value: string;
    onChange: (value: string) => void;
    onRun?: () => void;
    onSubmit?: () => void;
    readOnly?: boolean;
    /** The line the visualiser is on; gets a band across the editor and a marker in the gutter. */
    highlightLine?: number | null;
    /** A compile or runtime error to underline. */
    error?: EditorErrorMarker | null;
  }
>(function CodeEditor(
  { language, value, onChange, onRun, onSubmit, readOnly, highlightLine = null, error = null },
  ref,
) {
  // Handlers are kept in refs so the Monaco commands never capture stale state.
  const runRef = useRef(onRun);
  const submitRef = useRef(onSubmit);
  runRef.current = onRun;
  submitRef.current = onSubmit;

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const languageRef = useRef(language);
  languageRef.current = language;
  const lineDecoration = useRef<editor.IEditorDecorationsCollection | null>(null);

  const format = useCallback(() => {
    const instance = editorRef.current;
    const model = instance?.getModel();
    if (!instance || !model) return;

    const before = model.getValue();
    const after = formatCode(languageRef.current, before);
    if (after === before) return;

    // executeEdits keeps the undo stack, and pushing the selection back
    // stops the cursor jumping to the end of the file.
    const selection = instance.getSelection();
    instance.executeEdits('simulyn-format', [{ range: model.getFullModelRange(), text: after }]);
    if (selection) instance.setSelection(selection);
    instance.pushUndoStop();
  }, []);

  useImperativeHandle(ref, () => ({ format }), [format]);

  // The band that follows the visualiser's current step.
  useEffect(() => {
    const instance = editorRef.current;
    const monaco = monacoRef.current;
    if (!instance || !monaco) return;

    lineDecoration.current ??= instance.createDecorationsCollection();
    const count = instance.getModel()?.getLineCount() ?? 0;
    if (!highlightLine || highlightLine < 1 || highlightLine > count) {
      lineDecoration.current.clear();
      return;
    }
    lineDecoration.current.set([
      {
        range: new monaco.Range(highlightLine, 1, highlightLine, 1),
        options: {
          isWholeLine: true,
          className: 'viz-exec-line',
          glyphMarginClassName: 'viz-exec-glyph',
        },
      },
    ]);
    instance.revealLineInCenterIfOutsideViewport(highlightLine, 0);
  }, [highlightLine, value]);

  // Error underline, via the same markers Monaco uses for its own diagnostics.
  useEffect(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) return;

    if (!error || error.line < 1 || error.line > model.getLineCount()) {
      monaco.editor.setModelMarkers(model, 'simulyn', []);
      return;
    }
    monaco.editor.setModelMarkers(model, 'simulyn', [
      {
        severity: monaco.MarkerSeverity.Error,
        message: error.message,
        startLineNumber: error.line,
        startColumn: model.getLineFirstNonWhitespaceColumn(error.line) || 1,
        endLineNumber: error.line,
        endColumn: model.getLineMaxColumn(error.line),
      },
    ]);
    editorRef.current?.revealLineInCenterIfOutsideViewport(error.line, 0);
  }, [error, value, language]);

  return (
    <Editor
      language={MONACO_LANGUAGE[language]}
      theme={THEME_NAME}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      beforeMount={defineTheme}
      onMount={(instance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
        editorRef.current = instance;
        monacoRef.current = monaco;
        instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current?.());
        instance.addCommand(
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
          () => submitRef.current?.(),
        );
        instance.addAction({
          id: 'simulyn.format',
          label: 'Format code',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
          contextMenuGroupId: '1_modification',
          contextMenuOrder: 1.5,
          run: () => format(),
        });
      }}
      loading={<Skeleton className="h-full w-full rounded-none" />}
      options={{
        readOnly,
        glyphMargin: true,
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
});
