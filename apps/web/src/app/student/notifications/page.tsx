'use client';

import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { NotificationRow, type NotificationItem } from '@/components/layout/notification-bell';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

export default function StudentNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  useEffect(() => {
    void api.get<NotificationItem[]>('/notifications').then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <span className="instrument">Inbox</span>
          <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">Notifications</h1>
        </header>
        <Panel>
          <PanelHeader
            label="Latest"
            title="Exams, hackathons & class announcements"
            action={
              items?.some((i) => !i.readAt) ? (
                <Button size="sm" variant="ghost" onClick={() =>
                    void api
                      .post('/notifications/read-all')
                      .then(() => api.get<NotificationItem[]>('/notifications').then(setItems))
                      .catch(() => undefined)
                  }>
                  Mark all read
                </Button>
              ) : null
            }
          />
          {!items ? (
            <div className="p-5"><Skeleton className="h-40" /></div>
          ) : items.length === 0 ? (
            <Empty icon={Bell} title="Nothing yet" description="Exam, hackathon and class announcements will show up here." />
          ) : (
            <div className="divide-y divide-line pb-2">
              {items.map((n) => <NotificationRow
                  key={n.id}
                  n={n}
                  onClick={() => {
                    if (n.readAt) return;
                    setItems((l) => l && l.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)));
                    void api.post(`/notifications/${n.id}/read`).catch(() => undefined);
                  }}
                />)}
            </div>
          )}
        </Panel>
      </div>
    </PageTransition>
  );
}
