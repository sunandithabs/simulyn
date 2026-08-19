'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const STORAGE_KEY = 'simulyn.study-consent-seen';

/**
 * Blocking overlay shown once per participant before they can use the app,
 * for the classroom evaluation study. Skips silently if the study endpoints
 * are unreachable so it never locks anyone out of the real product.
 */
export function ConsentGate() {
  const { user } = useAuth();
  const [needsConsent, setNeedsConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    api
      .get<{ consented: boolean }>('/research/status')
      .then(({ consented }) => {
        if (!consented) setNeedsConsent(true);
        else sessionStorage.setItem(STORAGE_KEY, '1');
      })
      .catch(() => {
        /* study module unreachable — don't block product usage */
      });
  }, [user]);

  if (!needsConsent) return null;

  async function accept() {
    setSubmitting(true);
    try {
      await api.post('/research/consent');
      sessionStorage.setItem(STORAGE_KEY, '1');
      setNeedsConsent(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="glass max-w-md p-6">
        <div className="font-display text-lg font-semibold text-paper">
          Before you start
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Simulyn is being evaluated as part of a student research study. Using it during
          this period means your in-app activity (submissions, timings, and proctoring
          events) is logged and may appear, in de-identified form, in a research paper.
          No names or emails are included in any export. You can stop using the platform
          at any time.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          By continuing, you confirm you're 18+ (or have instructor/guardian permission)
          and agree to take part.
        </p>
        <Button className="mt-5 w-full justify-center" onClick={accept} loading={submitting}>
          I agree — continue
        </Button>
      </div>
    </div>
  );
}
