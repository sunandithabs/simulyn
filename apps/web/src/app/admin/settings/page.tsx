'use client';

import { Cpu, Database, Info, Radio, RefreshCw, Timer } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { SystemHealth, SystemSettings } from '@/lib/types';
import { formatBytes, formatUptime } from '@/lib/utils';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadHealth = useCallback(async () => {
    setRefreshing(true);
    try {
      setHealth(await api.get<SystemHealth>('/admin/health'));
    } catch {
      setHealth(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void api.get<SystemSettings>('/admin/settings').then(setSettings).catch(() => setSettings(null));
    void loadHealth();
    const timer = setInterval(() => void loadHealth(), 15_000);
    return () => clearInterval(timer);
  }, [loadHealth]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="instrument">Configuration</span>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">
              Settings
            </h1>
          </div>
          <Button variant="outline" onClick={() => void loadHealth()} loading={refreshing}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </header>

        <Panel className="mt-6">
          <PanelHeader label="Live" title="System health" />
          <PanelBody className="pt-4">
            {health ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { icon: Timer, label: 'uptime', value: formatUptime(health.uptimeSeconds) },
                    {
                      icon: Database,
                      label: 'database',
                      value: formatBytes(health.database.sizeBytes),
                    },
                    { icon: Cpu, label: 'memory (rss)', value: formatBytes(health.memory.rssBytes) },
                    {
                      icon: Radio,
                      label: 'live sockets',
                      value: String(health.websockets.connected),
                    },
                  ].map((entry) => (
                    <div key={entry.label} className="rounded-lg border border-line p-3">
                      <entry.icon className="h-4 w-4 text-violet-lit" strokeWidth={1.6} />
                      <div className="mt-2.5 text-[18px] leading-none font-semibold text-paper tabular">
                        {entry.value}
                      </div>
                      <div className="instrument mt-1.5">{entry.label}</div>
                    </div>
                  ))}
                </div>

                <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-line pt-4 sm:grid-cols-2">
                  {[
                    ['runtime', `Node ${health.node} on ${health.platform}`],
                    ['environment', health.environment],
                    ['database engine', health.database.provider],
                    [
                      'execution slots',
                      `${health.execution.concurrency.free} free of ${health.execution.concurrency.capacity}${
                        health.execution.concurrency.queued > 0
                          ? `, ${health.execution.concurrency.queued} queued`
                          : ''
                      }`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-3">
                      <dt className="instrument">{label}</dt>
                      <dd className="truncate font-mono text-[11.5px] text-muted">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 border-t border-line pt-4">
                  <span className="instrument">Language runtimes</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(health.execution.languages).map(([lang, ok]) => (
                      <Badge key={lang} tone={ok ? 'pass' : 'fail'}>
                        {lang} {ok ? 'ready' : 'missing'}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <Skeleton className="h-48 w-full" />
            )}
          </PanelBody>
        </Panel>

        {settings?.readOnly ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-brass/30 bg-brass/[0.06] px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brass-lit" strokeWidth={1.8} />
            <div>
              <p className="text-[13px] text-paper">These values are read from the environment.</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                They are applied when the API starts, so changing one means editing{' '}
                <code className="font-mono text-brass-lit">apps/api/.env</code> (or the container
                environment) and restarting. Each row shows the variable to set. Secrets are never
                sent to the browser — only whether they are configured.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {settings ? (
            settings.groups.map((group) => (
              <Panel key={group.key}>
                <PanelHeader label={group.key} title={group.label} />
                <PanelBody className="pt-4">
                  {group.note ? <p className="mb-3 text-[12.5px] text-muted">{group.note}</p> : null}

                  <dl className="divide-y divide-line">
                    {group.entries.map((entry) => (
                      <div
                        key={`${group.key}-${entry.label}`}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
                      >
                        <div className="min-w-0">
                          <dt className="text-[13.5px] text-paper">{entry.label}</dt>
                          {entry.env !== '—' ? (
                            <code className="font-mono text-[10px] text-faint">{entry.env}</code>
                          ) : null}
                        </div>
                        <dd className="flex items-center gap-2">
                          {entry.secret ? <Badge tone="brass">secret</Badge> : null}
                          <span className="font-mono text-[12px] break-all text-brass-lit">
                            {entry.value}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </PanelBody>
              </Panel>
            ))
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
