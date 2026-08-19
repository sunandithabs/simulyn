'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface LockdownValue {
  locked: boolean;
  setLocked: (locked: boolean) => void;
}

/**
 * Set while a proctored exam is in progress. The shell reads it and hides its
 * navigation, so a student cannot click away to the problem bank mid-paper.
 *
 * Defaults to unlocked, so the teacher and admin shells can use the same
 * component without a provider.
 */
const LockdownContext = createContext<LockdownValue>({ locked: false, setLocked: () => {} });

export function LockdownProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(false);
  const value = useMemo(() => ({ locked, setLocked }), [locked]);
  return <LockdownContext.Provider value={value}>{children}</LockdownContext.Provider>;
}

export function useLockdown(): LockdownValue {
  return useContext(LockdownContext);
}
