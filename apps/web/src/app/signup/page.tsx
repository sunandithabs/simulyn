'use client';

import { motion } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SignalTrace } from '@/components/brand/signal-trace';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { HOME_ROUTE, useAuth } from '@/hooks/useAuth';

export default function SignupPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(HOME_ROUTE[user.role]);
  }, [user, loading, router]);

  async function submit() {
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const account = await register({
        displayName: displayName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      });
      router.push(HOME_ROUTE[account.role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
      setBusy(false);
    }
  }

  return (
    <main className="simulyn-login relative flex min-h-dvh items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-[26rem]"
      >
        <div className="glass overflow-hidden">
          <div className="relative border-b border-line">
            <SignalTrace className="block h-16 w-full opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ink-raised/80" />
          </div>

          <div className="relative px-7 pt-6 pb-7">
            <Link
              href="/login"
              aria-label="Back to sign in"
              className="absolute top-4 right-4 rounded-md p-2 text-muted transition-all hover:bg-violet/15 hover:text-paper hover:shadow-[0_0_0_1px_#a78bfa40]"
            >
              <X className="h-5 w-5" />
            </Link>
            <span className="instrument">Student registration</span>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
              Create account
            </h1>

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <Field label="Full name">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  maxLength={120}
                  autoFocus
                  required
                />
              </Field>
              <Field label="Username">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  minLength={3}
                  maxLength={40}
                  pattern="[a-zA-Z0-9._\-]+"
                  title="Letters, digits, dots, underscores and hyphens"
                  required
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>
              <Field label="Confirm password">
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
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
                Create account
              </Button>
            </form>

            <p className="mt-5 text-center text-[13px] text-muted">
              Already registered?{' '}
              <Link href="/login" className="text-violet-lit hover:text-paper">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
