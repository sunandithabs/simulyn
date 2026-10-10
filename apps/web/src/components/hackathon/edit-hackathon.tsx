'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { HackathonForm } from '@/components/hackathon/hackathon-form';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { HackathonDetail } from '@/lib/types';

export function EditHackathon({ base }: { base: string }) {
  const { id } = useParams<{ id: string }>();
  const [h, setH] = useState<HackathonDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get<HackathonDetail>(`/hackathons/${id}`)
      .then(setH)
      .catch(() => setFailed(true));
  }, [id]);

  if (failed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Panel className="p-6 text-sm text-muted">Could not load this hackathon.</Panel>
      </div>
    );
  }
  if (!h) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  return <HackathonForm base={base} initial={h} />;
}
