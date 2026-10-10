'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { relativeTime } from '@/lib/utils';

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationRow({ n, onClick }: { n: NotificationItem; onClick?: () => void }) {
  const inner = (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        {!n.readAt ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-lit" /> : <span className="w-1.5 shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-paper">{n.title}</div>
          {n.body ? <div className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</div> : null}
          <div className="mt-0.5 text-[10px] text-faint">{relativeTime(n.createdAt)}</div>
        </div>
      </div>
    </div>
  );
  return n.link ? (
    <Link href={n.link} onClick={onClick} className="block hover:bg-violet/10 focus-visible:bg-violet/10 focus-visible:outline-none">{inner}</Link>
  ) : (
    inner
  );
}

export function NotificationBell({ allHref }: { allHref?: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api.get<NotificationItem[]>('/notifications').then(setItems).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const unread = items.filter((i) => !i.readAt).length;

  const markRead = useCallback((id: string) => {
    setItems((list) => list.map((i) => (i.id === id && !i.readAt ? { ...i, readAt: new Date().toISOString() } : i)));
    void api.post(`/notifications/${id}/read`).catch(() => undefined);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-lg p-2 text-muted transition-colors hover:bg-violet/15 hover:text-paper focus-visible:outline-2 focus-visible:outline-violet-lit"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-violet px-1 text-center text-[10px] leading-4 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="glass absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line-strong shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="instrument">notifications</span>
            {unread > 0 ? (
              <button
                className="text-xs text-violet-lit hover:text-white focus-visible:outline-2 focus-visible:outline-violet-lit"
                onClick={() => void api.post('/notifications/read-all').then(load).catch(() => undefined)}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 divide-y divide-line overflow-y-auto">
            {items.length === 0 ? <p className="p-4 text-center text-sm text-muted">You&apos;re all caught up.</p> : null}
            {items.slice(0, 8).map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onClick={() => {
                  markRead(n.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          {allHref ? (
            <Link href={allHref} onClick={() => setOpen(false)} className="block border-t border-line px-3 py-2 text-center text-xs text-violet-lit hover:text-white">
              View all
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
