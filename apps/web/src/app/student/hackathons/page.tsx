'use client';

import { Rocket } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { HackathonStatus, HackathonSummary } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

const HACKATHON_TONE: Record<HackathonStatus, 'pass' | 'violet' | 'neutral'> = {
  LIVE: 'pass',
  UPCOMING: 'violet',
  ENDED: 'neutral',
  DRAFT: 'neutral',
};

export default function StudentHackathonsPage() {
  const [items, setItems] = useState<HackathonSummary[] | null>(null);

  useEffect(() => {
    void api
      .get<HackathonSummary[]>('/hackathons')
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header>
          <span className="instrument">Compete</span>
          <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">Hackathons</h1>
          <p className="mt-1 text-sm text-muted">Form a team, build something, submit before the clock runs out.</p>
        </header>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {!items ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
          ) : items.length === 0 ? (
            <Panel className="sm:col-span-2">
              <Empty icon={Rocket} title="No hackathons yet" description="When an instructor publishes one, it will show up here." />
            </Panel>
          ) : (
            items.map((h) => (
              <Link key={h.id} href={`/student/hackathons/${h.id}`} className="block">
                <Panel hover className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center gap-2">
                    <Badge tone={HACKATHON_TONE[h.status]}>{h.status}</Badge>
                    <span className="font-mono text-[11px] text-faint">{h._count.teams} teams</span>
                  </div>
                  <h2 className="text-[15px] font-medium text-paper">{h.title}</h2>
                  <p className="line-clamp-2 text-sm text-muted">{h.description}</p>
                  <div className="mt-auto border-t border-line pt-3 font-mono text-[11px] text-muted">
                    {formatDateTime(h.startsAt)} → {formatDateTime(h.endsAt)}
                  </div>
                </Panel>
              </Link>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}
