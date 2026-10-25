'use client';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const CODE = 'CSE2026A';

export function JoinPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = user ? `simulyn-join-prompt-${user.id}` : '';

  useEffect(() => {
    if (!user || user.role !== 'STUDENT') return;
    try {
      if (localStorage.getItem(key)) return;
    } catch {}
    let live = true;
    api
      .get<any>('/classes')
      .then((r) => {
        const list = Array.isArray(r) ? r : (r?.data ?? r?.items ?? []);
        if (live && list.length === 0) setOpen(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [user, key]);

  function dismiss() {
    try {
      localStorage.setItem(key, '1');
    } catch {}
    setOpen(false);
  }

  async function join() {
    setBusy(true);
    try {
      await api.post('/classes/join', { code: CODE });
      toast.success('Joined the class');
      dismiss();
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not join the class');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-sm rounded-lg border border-white/10 bg-[#171120] p-6 shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">Join your class</h2>
        <p className="mt-2 text-sm opacity-80">
          Join the class <span className="font-mono">{CODE}</span> to start solving problems.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={dismiss}>
            Later
          </Button>
          <Button onClick={() => void join()} disabled={busy}>
            {busy ? 'Joining…' : 'Join class'}
          </Button>
        </div>
      </div>
    </div>
  );
}
