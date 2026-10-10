"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="instrument">Error</span>
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Something went wrong</h1>
      <p className="text-sm text-muted">An unexpected error occurred. Your work on the server is not affected.</p>
      <button onClick={reset} className="mt-2 rounded-lg border border-line px-4 py-2 text-sm text-paper hover:border-line-strong">
        Try again
      </button>
    </main>
  );
}
