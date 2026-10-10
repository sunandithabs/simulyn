'use client';

import { Plus, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { HackathonSummary } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export function HostHackathonList({ base }: { base: string }) {
  const [items, setItems] = useState<HackathonSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get<HackathonSummary[]>('/hackathons')
      .then(setItems)
      .catch(() => {
        setFailed(true);
        setItems([]);
      });
  }, []);

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">Host</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">Hackathons</h1>
          </div>
          <Link href={`${base}/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              New hackathon
            </Button>
          </Link>
        </header>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!items ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
          ) : items.length === 0 ? (
            <Panel className="sm:col-span-2 lg:col-span-3">
              <Empty
                icon={Rocket}
                title={failed ? "Could not load hackathons" : "No hackathons yet"}
                description={failed ? "Check your connection and refresh the page." : "Create one, publish it, and students can form teams and submit."}
                action={
                  <Link href={`${base}/new`}>
                    <Button size="sm">New hackathon</Button>
                  </Link>
                }
              />
            </Panel>
          ) : (
            items.map((h) => (
              <Link key={h.id} href={`${base}/${h.id}`} className="block">
                <Panel hover className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center gap-2">
                    <Badge tone={h.status === 'LIVE' ? 'pass' : h.status === 'UPCOMING' ? 'violet' : h.status === 'DRAFT' ? 'warn' : 'neutral'}>
                      {h.status}
                    </Badge>
                    <Badge tone="neutral">{h.mode === 'PROBLEMS' ? 'Problems' : 'Project'}</Badge>
                    <span className="ml-auto font-mono text-[11px] text-faint">{h._count.teams} teams</span>
                  </div>
                  <h2 className="text-[15px] font-medium text-paper">{h.title}</h2>
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
