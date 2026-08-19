'use client';

import { motion } from 'framer-motion';
import { AlertCircle, KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { HOME_ROUTE, useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export default function ChangePasswordPage() {
  const { user, loading, refresh, setUser } = useAuth();
  const router = useRouter();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('The two new passwords do not match');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/change-password', { oldPassword, newPassword });
      toast.success('Password changed');

      // Every session was revoked, so sign back in with the new password.
      const restored = await refresh();
      if (restored) {
        setUser({ ...restored, mustChangePassword: false });
        router.push(HOME_ROUTE[restored.role]);
      } else {
        router.push('/login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass w-full max-w-[26rem] p-7"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brass/40 bg-brass/12">
          <KeyRound className="h-5 w-5 text-brass-lit" strokeWidth={1.5} />
        </div>

        <span className="instrument mt-5 block">First sign-in</span>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
          Choose your own password
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your account was created with a temporary password. Pick a new one to continue to the
          workspace.
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <Field label="Temporary password">
            <Input
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <Field label="New password" hint="At least 6 characters.">
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </Field>

          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
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
            Change password
          </Button>
        </form>
      </motion.div>
    </main>
  );
}
