'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import type { ClassSummary } from '@/lib/types';

/** Matches the API's JoinClassDto, so a bad code is caught before the request. */
const CODE_PATTERN = /^[A-Za-z0-9]{4,12}$/;

export function JoinClassDialog({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  /** Fired with the class that was joined, so the caller can refresh. */
  onJoined?: (joined: ClassSummary) => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const trimmed = code.trim();
  const valid = CODE_PATTERN.test(trimmed);

  function close() {
    setCode('');
    onClose();
  }

  async function join() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const joined = await api.post<ClassSummary>('/classes/join', { code: trimmed });
      toast.success(`Joined ${joined.name}`, {
        description: `Taught by ${joined.teacher.displayName}.`,
      });
      onJoined?.(joined);
      close();
    } catch (error) {
      // The API distinguishes unknown code, archived class and already enrolled.
      toast.error(error instanceof Error ? error.message : 'Could not join that class');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      label="Enrolment"
      title="Join a class"
      description="Enter the code your instructor put on the screen."
      className="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!valid} onClick={() => void join()}>
            Join class
          </Button>
        </>
      }
    >
      <Field label="Join code" hint="Four to twelve letters and numbers. Case does not matter.">
        <Input
          value={code}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          placeholder="CSE2026A"
          className="text-center font-mono text-[19px] tracking-[0.22em] uppercase"
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void join();
          }}
        />
      </Field>
    </Modal>
  );
}
