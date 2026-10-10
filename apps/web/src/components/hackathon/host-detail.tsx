'use client';

import { Rocket } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import type { HackathonDetail, HackathonTeamAdminRow } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export function HostHackathonDetail() {
  const { id } = useParams<{ id: string }>();
  const base = usePathname().split('/').slice(0, 3).join('/');
  const [h, setH] = useState<HackathonDetail | null>(null);
  const [teams, setTeams] = useState<HackathonTeamAdminRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, { score: string; comment: string; parts: Record<string, string> }>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const [detail, rows] = await Promise.all([
      api.get<HackathonDetail>(`/hackathons/${id}`),
      api.get<HackathonTeamAdminRow[]>(`/hackathons/${id}/teams`),
    ]);
    setH(detail);
    setTeams(rows);
    setDraft((prev) => {
      const next = { ...prev };
      for (const t of rows) {
        const sid = t.submission?.id;
        if (sid && !next[sid]) next[sid] = {
          score: t.myScore ? String(t.myScore.score) : '',
          comment: t.myScore?.comment ?? '',
          parts: Object.fromEntries(Object.entries(t.myScore?.breakdown ?? {}).map(([k, v]) => [k, String(v)])),
        };
      }
      return next;
    });
  }, [id]);

  useEffect(() => {
    load().catch(() => {
      setFailed(true);
      toast.error('Could not load hackathon');
    });
  }, [load]);

  async function patch(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      await api.patch(`/hackathons/${id}`, body);
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function score(submissionId: string) {
    const d = draft[submissionId];
    const criteria = h?.criteria ?? [];
    let scorePart: Record<string, unknown>;
    if (criteria.length) {
      const breakdown: Record<string, number> = {};
      for (const c of criteria) {
        const raw = d?.parts?.[c.name]?.trim() ?? '';
        const v = raw === '' ? NaN : Number(raw);
        if (!Number.isInteger(v) || v < 0 || v > c.max) return toast.error(`${c.name}: whole number 0–${c.max}`);
        breakdown[c.name] = v;
      }
      scorePart = { breakdown };
    } else {
      const rawScore = d?.score?.trim() ?? '';
      const n = rawScore === '' ? NaN : Number(rawScore);
      if (!Number.isInteger(n) || n < 0 || n > 100) return toast.error('Score must be a whole number from 0 to 100');
      scorePart = { score: n };
    }
    setBusy(true);
    try {
      await api.put(`/hackathons/${id}/submissions/${submissionId}/score`, {
        ...scorePart,
        ...(d?.comment?.trim() ? { comment: d.comment.trim() } : {}),
      });
      toast.success('Score saved');
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save score');
    } finally {
      setBusy(false);
    }
  }

  if (!h) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {failed ? (
          <Panel>
            <Empty
              icon={Rocket}
              title="Hackathon not available"
              description="It may not exist, or you may not be its host."
              action={<Link href={base} className="text-sm text-violet-lit hover:text-white">Back to hackathons</Link>}
            />
          </Panel>
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </div>
    );
  }

  const ended = h.status === 'ENDED';
  const auto = h.mode === 'PROBLEMS';

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone={h.status === 'LIVE' ? 'pass' : h.status === 'UPCOMING' ? 'violet' : 'neutral'}>{h.status}</Badge>
            <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">{h.title}</h1>
            <p className="mt-1 font-mono text-[11px] text-muted">
              {formatDateTime(h.startsAt)} → {formatDateTime(h.endsAt)} · teams of up to {h.maxTeamSize}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!ended ? (
              <Link href={`${base}/${id}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>
            ) : null}
            <Button
              variant={h.isPublished ? 'outline' : 'primary'}
              disabled={busy}
              onClick={() => {
                if (h.isPublished && (teams?.length ?? 0) > 0 && !window.confirm('Unpublishing hides this hackathon from students, including registered teams. Continue?')) return;
                void patch({ isPublished: !h.isPublished }, h.isPublished ? 'Unpublished' : 'Published');
              }}
            >
              {h.isPublished ? 'Unpublish' : 'Publish'}
            </Button>
            {auto ? null : (
            <Button
              variant="outline"
              title={!ended ? 'Available once the hackathon has ended' : !h.isPublished ? 'Publish the hackathon first' : undefined}
              disabled={busy || !ended || !h.isPublished}
              onClick={() => patch({ resultsPublished: !h.resultsPublished }, h.resultsPublished ? 'Results hidden' : 'Results published')}
            >
              {h.resultsPublished ? 'Hide results' : 'Publish results'}
            </Button>
            )}
          </div>
        </header>

        <Panel>
          <PanelHeader label="Teams" title={`${teams?.length ?? 0} registered`} />
          <div className="p-5">
            {!teams ? (
              <Skeleton className="h-24 w-full" />
            ) : teams.length === 0 ? (
              <p className="text-sm text-muted">No teams yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {teams.map((t) => {
                  const s = t.submission;
                  const d = s ? draft[s.id] ?? { score: '', comment: '', parts: {} } : null;
                  return (
                    <li key={t.id} className="space-y-2 py-4">
                      <div className="flex flex-wrap items-baseline gap-3">
                        <span className="text-paper">{t.name}</span>
                        <span className="text-xs text-faint">{t.members.map((m) => m.user.displayName).join(', ')}</span>
                        {t.averageScore !== null ? (
                          <Badge tone="brass">
                            avg {Math.round(t.averageScore * 10) / 10} · {t.judgeCount} judge{t.judgeCount === 1 ? '' : 's'}
                          </Badge>
                        ) : null}
                      </div>
                      {auto ? null : s ? (
                        <>
                          <p className="text-sm text-paper">{s.title}</p>
                          <p className="text-sm whitespace-pre-wrap text-muted">{s.description}</p>
                          <p className="font-mono text-[11px] text-faint">
                            {s.repoUrl ? (
                              <a className="text-violet-lit underline" href={s.repoUrl} target="_blank" rel="noopener noreferrer">repo</a>
                            ) : null}
                            {s.repoUrl && s.demoUrl ? ' · ' : null}
                            {s.demoUrl ? (
                              <a className="text-violet-lit underline" href={s.demoUrl} target="_blank" rel="noopener noreferrer">demo</a>
                            ) : null}
                          </p>
                          {ended ? (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {h.criteria.length ? (
                                h.criteria.map((c) => (
                                  <Input
                                    key={c.name}
                                    className="w-28"
                                    type="number"
                                    min={0}
                                    max={c.max}
                                    placeholder={`${c.name} /${c.max}`}
                                    title={`${c.name} (0–${c.max})`}
                                    aria-label={`${c.name} score, 0 to ${c.max}`}
                                    value={d!.parts[c.name] ?? ''}
                                    onChange={(e) =>
                                      setDraft({ ...draft, [s.id]: { ...d!, parts: { ...d!.parts, [c.name]: e.target.value } } })
                                    }
                                  />
                                ))
                              ) : (
                                <Input
                                  className="w-24"
                                  type="number"
                                  min={0}
                                  max={100}
                                  placeholder="0–100"
                                  aria-label="Score, 0 to 100"
                                  value={d!.score}
                                  onChange={(e) => setDraft({ ...draft, [s.id]: { ...d!, score: e.target.value } })}
                                />
                              )}
                              <Input
                                className="min-w-[200px] flex-1"
                                placeholder="Comment (shown with results)"
                                aria-label="Comment"
                                value={d!.comment}
                                onChange={(e) => setDraft({ ...draft, [s.id]: { ...d!, comment: e.target.value } })}
                              />
                              <Button size="sm" disabled={busy} onClick={() => score(s.id)}>
                                Save score
                              </Button>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm text-faint italic">No submission yet</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {auto ? (
              <p className="mt-3 text-xs text-faint">Auto-scored from members' problem submissions — students see the live scoreboard.</p>
            ) : !ended ? (
              <p className="mt-3 text-xs text-faint">Scoring opens when the hackathon ends.</p>
            ) : null}
          </div>
        </Panel>
      </div>
    </PageTransition>
  );
}
