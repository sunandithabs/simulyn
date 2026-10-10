'use client';

import { Rocket } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { PageTransition } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Field, Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import type { HackathonDetail, HackathonInviteRow, HackathonLeaderboardRow, HackathonScoreboard, MyHackathonTeam } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export default function StudentHackathonPage() {
  const { id } = useParams<{ id: string }>();
  const me = useAuth().user?.id;
  const [h, setH] = useState<HackathonDetail | null>(null);
  const [board, setBoard] = useState<HackathonLeaderboardRow[] | null>(null);
  const [teamName, setTeamName] = useState('');
  const [code, setCode] = useState('');
  const [sub, setSub] = useState({ title: '', description: '', repoUrl: '', demoUrl: '' });
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<HackathonScoreboard | null>(null);
  const [invites, setInvites] = useState<HackathonInviteRow[]>([]);
  const [inviteName, setInviteName] = useState('');
  const [failed, setFailed] = useState(false);
  const seededSub = useRef<string | null>(null);

  const load = useCallback(async () => {
    const detail = await api.get<HackathonDetail>(`/hackathons/${id}`);
    setH(detail);
    const s = detail.myTeam?.submission;
    // Seed the form once per submission so a background reload never wipes unsaved edits.
    if (s && seededSub.current !== s.id) {
      seededSub.current = s.id;
      setSub({ title: s.title, description: s.description, repoUrl: s.repoUrl ?? '', demoUrl: s.demoUrl ?? '' });
    }
    if (detail.resultsPublished) {
      api.get<HackathonLeaderboardRow[]>(`/hackathons/${id}/leaderboard`).then(setBoard).catch(() => setBoard([]));
    }
  }, [id]);

  useEffect(() => {
    load().catch(() => {
      setFailed(true);
      toast.error('Could not load hackathon');
    });
  }, [load]);

  useEffect(() => {
    if (!h || h.status === 'DRAFT' || h.status === 'UPCOMING') return;
    const tick = () => (document.hidden ? undefined : api.get<HackathonScoreboard>(`/hackathons/${id}/scoreboard`).then(setLive).catch(() => undefined));
    void tick();
    if (h.status !== 'LIVE') return;
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, [h?.status, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get<HackathonInviteRow[]>('/hackathons/invites/mine')
      .then((r) => setInvites(r.filter((i) => i.team.hackathon.id === id)))
      .catch(() => setInvites([]));
  }, [id, h?.myTeam?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(errMsg(e, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  }

  if (!h) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {failed ? (
          <Panel>
            <Empty
              icon={Rocket}
              title="Hackathon not available"
              description="It may have been unpublished or the link is wrong."
              action={<Link href="/student/hackathons" className="text-sm text-violet-lit hover:text-white">Back to hackathons</Link>}
            />
          </Panel>
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </div>
    );
  }

  const team: MyHackathonTeam | null = h.myTeam;
  const ended = h.status === 'ENDED';

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <header>
          <div className="flex items-center gap-2">
            <Badge tone={h.status === 'LIVE' ? 'pass' : h.status === 'UPCOMING' ? 'violet' : 'neutral'}>{h.status}</Badge>
            <span className="font-mono text-[11px] text-faint">hosted by {h.host.displayName} · teams of up to {h.maxTeamSize}</span>
          </div>
          <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-white">{h.title}</h1>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {formatDateTime(h.startsAt)} → {formatDateTime(h.endsAt)}
          </p>
          <p className="mt-4 text-sm whitespace-pre-wrap text-paper">{h.description}</p>
          {h.criteria.length ? (
            <p className="mt-3 font-mono text-[11px] text-muted">
              Judged on: {h.criteria.map((c) => `${c.name} (${c.max})`).join(' · ')}
            </p>
          ) : null}
          {h.rules ? <p className="mt-3 text-sm whitespace-pre-wrap text-muted">{h.rules}</p> : null}
        </header>

        {!team ? (
          ended ? null : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Panel>
                <PanelHeader label="Team" title="Create a team" />
                <div className="space-y-3 p-5">
                  <Field label="Team name" hint="Teams of one are fine.">
                    <Input
                      value={teamName}
                      maxLength={60}
                      onChange={(e) => setTeamName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && teamName.trim() && !busy) void run(() => api.post(`/hackathons/${id}/teams`, { name: teamName }), 'Team created');
                      }}
                    />
                  </Field>
                  <Button
                    disabled={busy || !teamName.trim()}
                    onClick={() => run(() => api.post(`/hackathons/${id}/teams`, { name: teamName }), 'Team created')}
                  >
                    Create team
                  </Button>
                </div>
              </Panel>
              <Panel>
                <PanelHeader label="Team" title="Join with a code" />
                <div className="space-y-3 p-5">
                  <Field label="Join code">
                    <Input
                      value={code}
                      maxLength={20}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && code.trim() && !busy) void run(() => api.post(`/hackathons/${id}/join`, { code }), 'Joined team');
                      }}
                    />
                  </Field>
                  <Button
                    variant="outline"
                    disabled={busy || !code.trim()}
                    onClick={() => run(() => api.post(`/hackathons/${id}/join`, { code }), 'Joined team')}
                  >
                    Join team
                  </Button>
                </div>
              </Panel>
            </div>
          )
        ) : (
          <>
            <Panel>
              <PanelHeader
                label="Your team"
                title={team.name}
                action={
                  !ended ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => {
                        if (window.confirm(team.members.length === 1 ? 'You are the only member — leaving deletes this team. Continue?' : 'Leave this team?')) {
                          void run(() => api.post(`/hackathons/${id}/leave`), 'Left team');
                        }
                      }}>
                      Leave
                    </Button>
                  ) : null
                }
              />
              <div className="space-y-2 p-5 text-sm">
                {!ended && team.members.some((m) => m.isLeader && m.user.id === me) ? (
                  <div className="flex gap-2">
                    <Input className="flex-1" aria-label="Invite a student by username" placeholder="Invite a student by username" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                    <Button size="sm" disabled={busy || !inviteName.trim()} onClick={() => run(() => api.post(`/hackathons/${id}/invites`, { username: inviteName.trim() }).then(() => setInviteName('')), 'Invite sent')}>Invite</Button>
                  </div>
                ) : null}
                <p className="text-muted">
                  Join code <span className="font-mono text-brass-lit">{team.joinCode}</span> — share it with teammates.
                </p>
                <ul className="text-paper">
                  {team.members.map((m) => (
                    <li key={m.id}>
                      {m.user.displayName} {m.isLeader ? <span className="text-faint">(leader)</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>

            <Panel>
              <PanelHeader label="Project" title="Submission" />
              <div className="space-y-3 p-5">
                {h.status !== 'LIVE' ? (
                  <p className="text-sm text-muted">
                    {h.status === 'UPCOMING' ? 'Submissions open when the hackathon starts.' : 'Submissions are closed.'}
                  </p>
                ) : null}
                <Field label="Project title">
                  <Input value={sub.title} maxLength={120} disabled={h.status !== 'LIVE'} onChange={(e) => setSub({ ...sub, title: e.target.value })} />
                </Field>
                <Field label="Description">
                  <Textarea rows={5} value={sub.description} maxLength={5000} disabled={h.status !== 'LIVE'} onChange={(e) => setSub({ ...sub, description: e.target.value })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Repository URL">
                    <Input placeholder="https://github.com/…" value={sub.repoUrl} disabled={h.status !== 'LIVE'} onChange={(e) => setSub({ ...sub, repoUrl: e.target.value })} />
                  </Field>
                  <Field label="Demo URL">
                    <Input placeholder="https://…" value={sub.demoUrl} disabled={h.status !== 'LIVE'} onChange={(e) => setSub({ ...sub, demoUrl: e.target.value })} />
                  </Field>
                </div>
                {h.status === 'LIVE' ? (
                  <Button
                    disabled={busy || !sub.title.trim() || !sub.description.trim()}
                    onClick={() =>
                      run(
                        () =>
                          api.put(`/hackathons/${id}/submission`, {
                            title: sub.title,
                            description: sub.description,
                            ...(sub.repoUrl.trim() ? { repoUrl: sub.repoUrl.trim() } : {}),
                            ...(sub.demoUrl.trim() ? { demoUrl: sub.demoUrl.trim() } : {}),
                          }),
                        'Submission saved',
                      )
                    }
                  >
                    {team.submission ? 'Update submission' : 'Submit project'}
                  </Button>
                ) : null}
                {team.submission ? (
                  <p className="font-mono text-[11px] text-faint">last saved {formatDateTime(team.submission.submittedAt)}</p>
                ) : null}
              </div>
            </Panel>
          </>
        )}

        {invites.length > 0 && !team ? (
          <Panel>
            <PanelHeader label="Invites" title="Team invites" />
            <ul className="space-y-2 p-5 text-sm">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center gap-3">
                  <span className="flex-1 text-paper">{i.team.name} — from {i.inviter.displayName}</span>
                  <Button size="sm" disabled={busy} onClick={() => run(() => api.post(`/hackathons/invites/${i.id}/accept`), 'Joined team')}>Accept</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api.post(`/hackathons/invites/${i.id}/decline`), 'Declined')}>Decline</Button>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {h.mode === 'PROBLEMS' && h.problems?.length ? (
          <Panel>
            <PanelHeader label="Challenge" title="Problems" />
            <ul className="space-y-1 p-5 text-sm">
              {h.problems.map((p) => (
                <li key={p.id}>
                  <Link className="text-brass-lit hover:underline" href={`/student/problems/${p.id}`}>{p.title}</Link>
                  <span className="text-faint"> · {p.difficulty} · {p.category}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {live ? (
          <Panel>
            <PanelHeader label={h.status === 'LIVE' ? 'Live' : 'Final'} title="Scoreboard" />
            <ol className="divide-y divide-line p-5 text-sm">
              {live.rows.length === 0 ? <li className="text-muted">No teams yet.</li> : null}
              {live.rows.map((r, i) => (
                <li key={`${r.team}-${i}`} className="flex gap-4 py-2">
                  <span className="w-6 font-mono text-brass-lit">{r.rank ? `#${r.rank}` : ''}</span>
                  <span className="flex-1 text-paper">{r.team}</span>
                  <span className="font-mono tabular text-paper">
                    {live.mode === 'PROBLEMS' ? `${r.score} pts · ${r.solved} solved` : r.submitted ? 'submitted' : '—'}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        ) : null}

        {h.resultsPublished ? (
          <Panel>
            <PanelHeader label="Results" title="Leaderboard" />
            <div className="p-5">
              {!board ? (
                <Skeleton className="h-24 w-full" />
              ) : board.length === 0 ? (
                <p className="text-sm text-muted">No scored submissions.</p>
              ) : (
                <ol className="divide-y divide-line">
                  {board.map((r) => (
                    <li key={r.submissionId} className="flex items-baseline gap-4 py-3">
                      <span className="w-6 font-mono text-brass-lit">#{r.rank}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-paper">{r.team} — {r.title}</div>
                        <div className="text-xs text-faint">{r.members.join(', ')}</div>
                      </div>
                      <span className="font-mono text-paper tabular">{r.averageScore}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Panel>
        ) : null}
      </div>
    </PageTransition>
  );
}
