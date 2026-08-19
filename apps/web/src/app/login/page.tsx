'use client';

import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SignalTrace } from '@/components/brand/signal-trace';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { HOME_ROUTE, useAuth } from '@/hooks/useAuth';
import type { Role } from '@/lib/types';

const ROLES: { value: Role; label: string }[] = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'TEACHER', label: 'Teacher' },
  { value: 'ADMIN', label: 'Admin' },
];

const DEMO_ACCOUNTS: Record<Role, { name: string; username: string; password: string }[]> = {
  STUDENT: [
    { name: 'Sunan', username: 'sunan', password: 'student1' },
    { name: 'Sanjan', username: 'sanjan', password: 'student4' },
    { name: 'Vahini', username: 'vahini', password: 'student3' },
  ],
  TEACHER: [{ name: 'Dr. Sunitha', username: 'dr.sunitha', password: 'teacher1' }],
  ADMIN: [{ name: 'Administrator', username: 'admin', password: 'admin123' }],
};

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();

  const [role, setRole] = useState<Role>('STUDENT');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in — skip the form.
  useEffect(() => {
    if (!loading && user) {
      router.replace(user.mustChangePassword ? '/change-password' : HOME_ROUTE[user.role]);
    }
  }, [user, loading, router]);

  async function signIn(nextUsername: string, nextPassword: string) {
    setBusy(true);
    setError(null);
    try {
      const account = await login(nextUsername, nextPassword);
      router.push(account.mustChangePassword ? '/change-password' : HOME_ROUTE[account.role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6 py-12">
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-paper"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-[26rem]"
      >
        <div className="glass overflow-hidden">
          {/* A sliver of the bench trace, so the sign-in reads as the same instrument. */}
          <div className="relative border-b border-line">
            <SignalTrace className="block h-16 w-full opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ink-raised/80" />
          </div>

          <div className="px-7 pt-6 pb-7">
            <span className="instrument">Workspace access</span>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Sign in</h1>

            <div
              className="mt-6 flex gap-1 rounded-lg border border-line bg-ink-sunken/60 p-1"
              role="tablist"
              aria-label="Account type"
            >
              {ROLES.map((option) => (
                <button
                  key={option.value}
                  role="tab"
                  aria-selected={role === option.value}
                  onClick={() => setRole(option.value)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                    role === option.value
                      ? 'bg-violet/25 text-paper shadow-[inset_0_0_0_1px_#a78bfa40]'
                      : 'text-muted hover:text-paper'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void signIn(username, password);
              }}
            >
              <Field label="Username or email">
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="sunan"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </Field>

              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </Field>

              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-fault/30 bg-fault/10 px-3 py-2.5 text-[13px] text-fault"
                >
                  <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <Button type="submit" size="lg" className="w-full" loading={busy}>
                Sign in
              </Button>
            </form>

            <div className="mt-6">
              <div className="flex items-center gap-3">
                <span className="instrument">Demo accounts</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS[role].map((account) => (
                  <button
                    key={account.username}
                    disabled={busy}
                    onClick={() => {
                      setUsername(account.username);
                      setPassword(account.password);
                      void signIn(account.username, account.password);
                    }}
                    className="rounded-lg border border-line-strong bg-white/[0.03] px-3 py-1.5 text-[13px] text-muted transition-all duration-200 hover:border-violet-lit/50 hover:bg-violet/15 hover:text-paper disabled:opacity-50"
                  >
                    {account.name}
                    <span className="ml-1.5 font-mono text-[10px] text-faint">
                      {account.username}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
