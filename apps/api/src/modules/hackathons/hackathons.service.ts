import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Role } from '@simulyn/shared';
import { randomInt } from 'node:crypto';

import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from '../../common/constants';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  CreateHackathonDto,
  CreateTeamDto,
  ScoreDto,
  SubmissionDto,
  UpdateHackathonDto,
} from './dto/hackathon.dto';

export interface Criterion { name: string; max: number }

function parseCriteria(raw: string): Criterion[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function cleanCriteria(input: Criterion[] | undefined): Criterion[] {
  const out = (input ?? []).map((c) => ({ name: c.name.trim(), max: c.max }));
  if (out.some((c) => !c.name)) throw new BadRequestException('Criterion names cannot be empty');
  if (new Set(out.map((c) => c.name.toLowerCase())).size !== out.length) {
    throw new BadRequestException('Criterion names must be unique');
  }
  return out;
}

export type HackathonStatus = 'DRAFT' | 'UPCOMING' | 'LIVE' | 'ENDED';

export function hackathonStatus(h: {
  isPublished: boolean;
  startsAt: Date;
  endsAt: Date;
}): HackathonStatus {
  if (!h.isPublished) return 'DRAFT';
  const now = Date.now();
  if (now < h.startsAt.getTime()) return 'UPCOMING';
  if (now > h.endsAt.getTime()) return 'ENDED';
  return 'LIVE';
}

function code(): string {
  let out = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) out += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  return out;
}

const MEMBER_SELECT = {
  id: true,
  isLeader: true,
  user: { select: { id: true, displayName: true, username: true } },
} as const;

@Injectable()
export class HackathonsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HackathonsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    // In-process tick: no scheduler dependency. The claim below is atomic, so
    // several API instances never announce the same start twice.
    this.timer = setInterval(() => void this.announceStarts(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async announceStarts() {
    try {
      const due = await this.prisma.hackathon.findMany({
        where: { isPublished: true, startNotifiedAt: null, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
        select: { id: true, title: true },
      });
      for (const h of due) {
        const claim = await this.prisma.hackathon.updateMany({
          where: { id: h.id, startNotifiedAt: null },
          data: { startNotifiedAt: new Date() },
        });
        if (!claim.count) continue;
        await this.notifications.notifyStudents({
          type: 'HACKATHON_STARTED',
          title: `Live now: ${h.title}`,
          link: `/student/hackathons/${h.id}`,
        });
      }
    } catch (e) {
      this.logger.warn(`Start announcement failed: ${(e as Error).message}`);
    }
  }

  private isStaff(user: AuthenticatedUser) {
    return user.role === Role.ADMIN || user.role === Role.TEACHER;
  }

  private async load(id: string) {
    const h = await this.prisma.hackathon.findUnique({
      where: { id },
      include: { host: { select: { displayName: true } }, _count: { select: { teams: true } } },
    });
    if (!h) throw new NotFoundException('Hackathon not found');
    return h;
  }

  /** Host (or any admin) only. */
  private async loadManaged(id: string, user: AuthenticatedUser) {
    const h = await this.load(id);
    if (user.role !== Role.ADMIN && h.hostId !== user.id) {
      throw new ForbiddenException('Only the host can manage this hackathon');
    }
    return h;
  }

  private shape<T extends { isPublished: boolean; startsAt: Date; endsAt: Date; criteria: string }>(h: T) {
    return { ...h, criteria: parseCriteria(h.criteria), status: hackathonStatus(h) };
  }

  /** Problem-mode needs real, published problems; duplicates are collapsed. */
  private async cleanProblemIds(ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids.map((i) => i.trim()).filter(Boolean))];
    if (!unique.length) return [];
    const found = await this.prisma.problem.findMany({
      where: { id: { in: unique }, isPublished: true },
      select: { id: true },
    });
    const missing = unique.filter((id) => !found.some((f) => f.id === id));
    if (missing.length) throw new BadRequestException(`Unknown or unpublished problem ids: ${missing.join(', ')}`);
    return unique;
  }

  private checkDates(startsAt: Date, endsAt: Date) {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Invalid dates');
    }
    if (endsAt <= startsAt) throw new BadRequestException('End must be after start');
  }

  // ── hosting ────────────────────────────────────────────────────────

  async create(dto: CreateHackathonDto, user: AuthenticatedUser) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.checkDates(startsAt, endsAt);
    const problemIds = await this.cleanProblemIds(dto.problemIds ?? []);
    if (dto.mode === 'PROBLEMS' && !problemIds.length) {
      throw new BadRequestException('Problem mode needs at least one problem');
    }
    const h = await this.prisma.hackathon.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        rules: dto.rules?.trim() || null,
        startsAt,
        endsAt,
        maxTeamSize: dto.maxTeamSize ?? 4,
        criteria: JSON.stringify(cleanCriteria(dto.criteria)),
        mode: dto.mode ?? 'PROJECT',
        problems: problemIds.length ? { create: problemIds.map((problemId) => ({ problemId })) } : undefined,
        hostId: user.id,
      },
      include: { host: { select: { displayName: true } }, _count: { select: { teams: true } } },
    });
    return this.shape(h);
  }

  async update(id: string, dto: UpdateHackathonDto, user: AuthenticatedUser) {
    const existing = await this.loadManaged(id, user);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    this.checkDates(startsAt, endsAt);
    const link = `/student/hackathons/${id}`;
    let criteria: string | undefined;
    if (dto.criteria) {
      const scored = await this.prisma.hackathonScore.count({ where: { submission: { team: { hackathonId: id } } } });
      if (scored > 0) throw new BadRequestException('Criteria cannot change once scoring has started');
      criteria = JSON.stringify(cleanCriteria(dto.criteria));
    }
    const status = hackathonStatus(existing);
    const started = status === 'LIVE' || status === 'ENDED';
    if (started && ((dto.mode && dto.mode !== existing.mode) || dto.problemIds)) {
      throw new BadRequestException('The format and problem list cannot change once the hackathon has started');
    }
    if (dto.maxTeamSize !== undefined) {
      const teams = await this.prisma.hackathonTeam.findMany({
        where: { hackathonId: id },
        select: { _count: { select: { members: true } } },
      });
      const biggest = Math.max(0, ...teams.map((t) => t._count.members));
      if (dto.maxTeamSize < biggest) {
        throw new BadRequestException(`A team already has ${biggest} members; the limit cannot go below that`);
      }
    }
    const problemIds = dto.problemIds ? await this.cleanProblemIds(dto.problemIds) : null;
    const mode = dto.mode ?? existing.mode;
    if (mode === 'PROBLEMS') {
      const have = problemIds ?? (await this.prisma.hackathonProblem.findMany({ where: { hackathonId: id }, select: { id: true } }));
      if (!have.length) throw new BadRequestException('Problem mode needs at least one problem');
    }
    if (problemIds) {
      await this.prisma.$transaction([
        this.prisma.hackathonProblem.deleteMany({ where: { hackathonId: id } }),
        this.prisma.hackathonProblem.createMany({ data: problemIds.map((problemId) => ({ hackathonId: id, problemId })) }),
      ]);
    }
    const h = await this.prisma.hackathon.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        rules: dto.rules === undefined ? undefined : dto.rules.trim() || null,
        startsAt,
        endsAt,
        maxTeamSize: dto.maxTeamSize,
        criteria,
        mode: dto.mode,
        isPublished: dto.isPublished,
        resultsPublished: dto.resultsPublished,
        // Moving the start into the future re-arms the "live now" announcement.
        startNotifiedAt: startsAt.getTime() > Date.now() && dto.startsAt ? null : undefined,
      },
      include: { host: { select: { displayName: true } }, _count: { select: { teams: true } } },
    });
    if (dto.isPublished && !existing.isPublished) {
      await this.notifications.notifyStudents({
        type: 'HACKATHON_PUBLISHED',
        title: `New hackathon: ${h.title}`,
        body: `Starts ${h.startsAt.toISOString()}`,
        link,
      });
    }
    if (dto.resultsPublished && !existing.resultsPublished) {
      const members = await this.prisma.hackathonMember.findMany({
        where: { hackathonId: id },
        select: { userId: true },
      });
      await this.notifications.notify(members.map((m) => m.userId), {
        type: 'HACKATHON_RESULTS',
        title: `Results are out: ${h.title}`,
        link,
      });
    }
    return this.shape(h);
  }

  async list(user: AuthenticatedUser) {
    const where =
      user.role === Role.ADMIN ? {} : user.role === Role.TEACHER ? { hostId: user.id } : { isPublished: true };
    const rows = await this.prisma.hackathon.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      include: { host: { select: { displayName: true } }, _count: { select: { teams: true } } },
    });
    return rows.map((h) => this.shape(h));
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const h = await this.load(id);
    const managed = user.role === Role.ADMIN || h.hostId === user.id;
    if (!h.isPublished && !managed) throw new NotFoundException('Hackathon not found');

    const membership = await this.prisma.hackathonMember.findUnique({
      where: { hackathonId_userId: { hackathonId: id, userId: user.id } },
      select: { teamId: true },
    });
    const myTeam = membership
      ? await this.prisma.hackathonTeam.findUnique({
          where: { id: membership.teamId },
          include: { members: { select: MEMBER_SELECT }, submission: true },
        })
      : null;

    const problems = await this.prisma.hackathonProblem.findMany({
      where: { hackathonId: id },
      select: { problem: { select: { id: true, title: true, difficulty: true, category: true, points: true } } },
    });
    // Problem titles stay hidden from students until the hackathon starts.
    const reveal = managed || hackathonStatus(h) !== 'UPCOMING';
    return { ...this.shape(h), managed, myTeam, problems: reveal ? problems.map((p) => p.problem) : [] };
  }

  // ── participation ──────────────────────────────────────────────────

  private async openForTeams(id: string) {
    const h = await this.load(id);
    const status = hackathonStatus(h);
    if (status === 'DRAFT') throw new NotFoundException('Hackathon not found');
    if (status === 'ENDED') throw new BadRequestException('This hackathon has ended');
    return h;
  }

  async createTeam(id: string, dto: CreateTeamDto, user: AuthenticatedUser) {
    await this.openForTeams(id);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Team name is required');

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const already = await tx.hackathonMember.findUnique({
            where: { hackathonId_userId: { hackathonId: id, userId: user.id } },
          });
          if (already) throw new ConflictException('You are already in a team for this hackathon');
          const team = await tx.hackathonTeam.create({
            data: {
              hackathonId: id,
              name,
              joinCode: code(),
              members: { create: { userId: user.id, hackathonId: id, isLeader: true } },
            },
            include: { members: { select: MEMBER_SELECT }, submission: true },
          });
          return team;
        });
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e;
        const meta = JSON.stringify((e as { meta?: unknown }).meta ?? '');
        if (meta.includes('name')) throw new ConflictException('That team name is taken');
        if (meta.includes('userId')) throw new ConflictException('You are already in a team for this hackathon');
        // joinCode collision → retry with a fresh code
      }
    }
    throw new ConflictException('Could not create team, please retry');
  }

  async joinTeam(id: string, rawCode: string, user: AuthenticatedUser) {
    const h = await this.openForTeams(id);
    const team = await this.prisma.hackathonTeam.findUnique({
      where: { joinCode: rawCode.trim().toUpperCase() },
      include: { _count: { select: { members: true } } },
    });
    if (!team || team.hackathonId !== id) throw new NotFoundException('No team with that code');
    if (team._count.members >= h.maxTeamSize) throw new ConflictException('That team is full');
    try {
      // Re-check the size inside the transaction so two simultaneous joins cannot overfill a team.
      await this.prisma.$transaction(async (tx) => {
        const member = await tx.hackathonMember.create({
          data: { teamId: team.id, userId: user.id, hackathonId: id },
        });
        const size = await tx.hackathonMember.count({ where: { teamId: team.id } });
        if (size > h.maxTeamSize) {
          await tx.hackathonMember.delete({ where: { id: member.id } });
          throw new ConflictException('That team is full');
        }
      });
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('You are already in a team for this hackathon');
      }
      throw e;
    }
    return this.prisma.hackathonTeam.findUnique({
      where: { id: team.id },
      include: { members: { select: MEMBER_SELECT }, submission: true },
    });
  }

  // ── invites ────────────────────────────────────────────────────────

  async invite(id: string, rawUsername: string, user: AuthenticatedUser) {
    const h = await this.openForTeams(id);
    const me = await this.prisma.hackathonMember.findUnique({
      where: { hackathonId_userId: { hackathonId: id, userId: user.id } },
      include: { team: { include: { _count: { select: { members: true } } } } },
    });
    if (!me?.isLeader) throw new ForbiddenException('Only the team leader can invite');
    if (me.team._count.members >= h.maxTeamSize) throw new ConflictException('Your team is full');
    const target = await this.prisma.user.findUnique({
      where: { username: rawUsername.trim() },
      select: { id: true, role: true, isActive: true },
    });
    if (!target || !target.isActive || target.role !== Role.STUDENT) throw new NotFoundException('No student with that username');
    if (target.id === user.id) throw new BadRequestException('You cannot invite yourself');
    const inTeam = await this.prisma.hackathonMember.findUnique({
      where: { hackathonId_userId: { hackathonId: id, userId: target.id } },
    });
    if (inTeam) throw new ConflictException('That student is already in a team');
    try {
      const invite = await this.prisma.hackathonInvite.create({
        data: { teamId: me.teamId, hackathonId: id, inviteeId: target.id, inviterId: user.id },
      });
      await this.notifications.notify([target.id], {
        type: 'HACKATHON_INVITE',
        title: `Team invite: ${me.team.name}`,
        body: h.title,
        link: `/student/hackathons/${id}`,
      });
      return invite;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Already invited');
      throw e;
    }
  }

  async myInvites(user: AuthenticatedUser) {
    const rows = await this.prisma.hackathonInvite.findMany({
      where: { inviteeId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        team: { select: { name: true, hackathon: { select: { id: true, title: true, endsAt: true } } } },
        inviter: { select: { displayName: true, username: true } },
      },
    });
    return rows.filter((r) => r.team.hackathon.endsAt > new Date());
  }

  async acceptInvite(inviteId: string, user: AuthenticatedUser) {
    const inv = await this.prisma.hackathonInvite.findUnique({ where: { id: inviteId } });
    if (!inv || inv.inviteeId !== user.id) throw new NotFoundException('Invite not found');
    const team = await this.joinById(inv.hackathonId, inv.teamId, user);
    await this.prisma.hackathonInvite.deleteMany({ where: { hackathonId: inv.hackathonId, inviteeId: user.id } });
    return team;
  }

  async declineInvite(inviteId: string, user: AuthenticatedUser) {
    const r = await this.prisma.hackathonInvite.deleteMany({ where: { id: inviteId, inviteeId: user.id } });
    if (!r.count) throw new NotFoundException('Invite not found');
    return { declined: true };
  }

  private async joinById(hackathonId: string, teamId: string, user: AuthenticatedUser) {
    const team = await this.prisma.hackathonTeam.findUnique({ where: { id: teamId }, select: { joinCode: true } });
    if (!team) throw new NotFoundException('Team no longer exists');
    return this.joinTeam(hackathonId, team.joinCode, user);
  }

  async leaveTeam(id: string, user: AuthenticatedUser) {
    await this.openForTeams(id);
    const m = await this.prisma.hackathonMember.findUnique({
      where: { hackathonId_userId: { hackathonId: id, userId: user.id } },
    });
    if (!m) throw new NotFoundException('You are not in a team');
    await this.prisma.$transaction(async (tx) => {
      await tx.hackathonMember.delete({ where: { id: m.id } });
      const rest = await tx.hackathonMember.findMany({
        where: { teamId: m.teamId },
        orderBy: { joinedAt: 'asc' },
      });
      if (rest.length === 0) {
        await tx.hackathonTeam.delete({ where: { id: m.teamId } });
      } else if (m.isLeader) {
        await tx.hackathonMember.update({ where: { id: rest[0].id }, data: { isLeader: true } });
      }
    });
    return { left: true };
  }

  async upsertSubmission(id: string, dto: SubmissionDto, user: AuthenticatedUser) {
    const h = await this.load(id);
    if (hackathonStatus(h) !== 'LIVE') {
      throw new BadRequestException('Submissions are only accepted while the hackathon is live');
    }
    const m = await this.prisma.hackathonMember.findUnique({
      where: { hackathonId_userId: { hackathonId: id, userId: user.id } },
    });
    if (!m) throw new ForbiddenException('Join or create a team first');
    const data = {
      title: dto.title.trim(),
      description: dto.description.trim(),
      repoUrl: dto.repoUrl ?? null,
      demoUrl: dto.demoUrl ?? null,
    };
    return this.prisma.hackathonSubmission.upsert({
      where: { teamId: m.teamId },
      create: { teamId: m.teamId, ...data },
      update: data,
    });
  }

  // ── judging ────────────────────────────────────────────────────────

  async teams(id: string, user: AuthenticatedUser) {
    await this.loadManaged(id, user);
    const teams = await this.prisma.hackathonTeam.findMany({
      where: { hackathonId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        members: { select: MEMBER_SELECT },
        submission: { include: { scores: { select: { judgeId: true, score: true, comment: true, breakdown: true } } } },
      },
    });
    return teams.map((t) => {
      const scores = t.submission?.scores ?? [];
      const mine = scores.find((s) => s.judgeId === user.id) ?? null;
      return {
        id: t.id,
        name: t.name,
        joinCode: t.joinCode,
        members: t.members,
        submission: t.submission
          ? {
              id: t.submission.id,
              title: t.submission.title,
              description: t.submission.description,
              repoUrl: t.submission.repoUrl,
              demoUrl: t.submission.demoUrl,
              submittedAt: t.submission.submittedAt,
            }
          : null,
        judgeCount: scores.length,
        averageScore: scores.length ? scores.reduce((a, s) => a + s.score, 0) / scores.length : null,
        myScore: mine
          ? { score: mine.score, comment: mine.comment, breakdown: mine.breakdown ? JSON.parse(mine.breakdown) : null }
          : null,
      };
    });
  }

  async score(id: string, submissionId: string, dto: ScoreDto, user: AuthenticatedUser) {
    const h = await this.loadManaged(id, user);
    if (new Date() < h.endsAt) throw new BadRequestException('Scoring opens once the hackathon has ended');
    const sub = await this.prisma.hackathonSubmission.findUnique({
      where: { id: submissionId },
      include: { team: { select: { hackathonId: true } } },
    });
    if (!sub || sub.team.hackathonId !== id) throw new NotFoundException('Submission not found');
    const comment = dto.comment?.trim() || null;
    const criteria = parseCriteria(h.criteria);
    let total: number;
    let breakdown: string | null = null;
    if (criteria.length) {
      const b = dto.breakdown ?? {};
      let got = 0;
      for (const c of criteria) {
        const v = b[c.name];
        if (!Number.isInteger(v) || v < 0 || v > c.max) {
          throw new BadRequestException(`"${c.name}" needs a whole number from 0 to ${c.max}`);
        }
        got += v;
      }
      total = Math.round((got / criteria.reduce((a, c) => a + c.max, 0)) * 100);
      breakdown = JSON.stringify(Object.fromEntries(criteria.map((c) => [c.name, b[c.name]])));
    } else {
      if (dto.score === undefined) throw new BadRequestException('score is required');
      total = dto.score;
    }
    return this.prisma.hackathonScore.upsert({
      where: { submissionId_judgeId: { submissionId, judgeId: user.id } },
      create: { submissionId, judgeId: user.id, score: total, breakdown, comment },
      update: { score: total, breakdown, comment },
    });
  }

  /** Live scoreboard: problem mode ranks teams by best scores on the hackathon's problems. */
  async scoreboard(id: string, user: AuthenticatedUser) {
    const h = await this.load(id);
    const managed = user.role === Role.ADMIN || h.hostId === user.id;
    const status = hackathonStatus(h);
    if (!managed && (status === 'DRAFT' || status === 'UPCOMING')) {
      throw new ForbiddenException('The scoreboard opens when the hackathon starts');
    }
    const teams = await this.prisma.hackathonTeam.findMany({
      where: { hackathonId: id },
      include: { members: { select: { userId: true } }, submission: { select: { id: true } } },
    });
    if (h.mode !== 'PROBLEMS') {
      return {
        mode: h.mode,
        rows: teams.map((t) => ({ team: t.name, members: t.members.length, submitted: !!t.submission })),
      };
    }
    const hp = await this.prisma.hackathonProblem.findMany({ where: { hackathonId: id }, select: { problemId: true } });
    const problemIds = hp.map((p) => p.problemId);
    const userIds = teams.flatMap((t) => t.members.map((m) => m.userId));
    const subs = userIds.length && problemIds.length
      ? await this.prisma.submission.findMany({
          where: { userId: { in: userIds }, problemId: { in: problemIds }, examAttemptId: null, createdAt: { gte: h.startsAt, lte: h.endsAt } },
          select: { userId: true, problemId: true, score: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const rows = teams.map((t) => {
      const ids = new Set(t.members.map((m) => m.userId));
      const best = new Map<string, { score: number; at: Date }>();
      for (const s of subs) {
        if (!ids.has(s.userId)) continue;
        const cur = best.get(s.problemId);
        if (!cur || s.score > cur.score) best.set(s.problemId, { score: s.score, at: s.createdAt });
      }
      const vals = [...best.values()];
      return {
        team: t.name,
        score: vals.reduce((a, v) => a + v.score, 0),
        solved: vals.filter((v) => v.score > 0).length,
        lastAt: vals.length ? new Date(Math.max(...vals.map((v) => v.at.getTime()))) : null,
      };
    });
    rows.sort((a, b) => b.score - a.score || (a.lastAt?.getTime() ?? Infinity) - (b.lastAt?.getTime() ?? Infinity));
    let rank = 0;
    return {
      mode: h.mode,
      rows: rows.map((r, i) => {
        if (i === 0 || r.score !== rows[i - 1].score) rank = i + 1;
        return { rank, ...r };
      }),
    };
  }

  async leaderboard(id: string, user: AuthenticatedUser) {
    const h = await this.load(id);
    const managed = user.role === Role.ADMIN || h.hostId === user.id;
    if (!managed && !(h.isPublished && h.resultsPublished)) {
      throw new ForbiddenException('Results have not been published yet');
    }
    const subs = await this.prisma.hackathonSubmission.findMany({
      where: { team: { hackathonId: id }, scores: { some: {} } },
      include: {
        scores: { select: { score: true, comment: true } },
        team: { select: { name: true, members: { select: { user: { select: { displayName: true } } } } } },
      },
    });
    const rows = subs
      .map((s) => ({
        submissionId: s.id,
        team: s.team.name,
        members: s.team.members.map((m) => m.user.displayName),
        title: s.title,
        repoUrl: s.repoUrl,
        demoUrl: s.demoUrl,
        averageScore: s.scores.reduce((a, x) => a + x.score, 0) / s.scores.length,
        judgeCount: s.scores.length,
        // Judge comments go to the team and host once results are public.
        comments: s.scores.map((x) => x.comment).filter((c): c is string => !!c),
      }))
      .sort((a, b) => b.averageScore - a.averageScore);
    let rank = 0;
    let prev: number | null = null;
    return rows.map((r, i) => {
      if (prev === null || r.averageScore !== prev) rank = i + 1;
      prev = r.averageScore;
      return { rank, ...r, averageScore: Math.round(r.averageScore * 10) / 10 };
    });
  }
}
