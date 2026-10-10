import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="instrument">404</span>
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Page not found</h1>
      <p className="text-sm text-muted">That page doesn&apos;t exist or you don&apos;t have access to it.</p>
      <Link href="/" className="mt-2 text-sm text-violet-lit hover:text-white">
        Back to home
      </Link>
    </main>
  );
}
