import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  BADGE_DEFINITIONS,
  LEVEL_THRESHOLDS,
  levelForXp,
  parseJson,
  Role,
  xpToNextLevel,
  type BadgeCondition,
} from '@simulyn/shared';

import { PrismaService } from '../../prisma/prisma.service';

export interface AwardResult {
  xp: number;
  xpAwarded: number;
  level: number;
  leveledUp: boolean;
  currentStreak: number;
  longestStreak: number;
  problemsSolved: number;
  newBadges: { key: string; name: string; icon: string; description: string }[];
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  xp: number;
  level: number;
  problemsSolved: number;
  currentStreak: number;
  isCurrentUser: boolean;
}

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const DAY_MS = 86_400_000;

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async ensureRecord(userId: string) {
    return this.prisma.gamification.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  // ── XP & streaks ───────────────────────────────────────────────────

  /**
   * Adds XP, refreshes the daily streak and recomputes the solved count.
   * Called by the submissions module after a fully passing, non-exam attempt.
   */
  async awardXP(userId: string, points: number): Promise<AwardResult> {
    const record = await this.ensureRecord(userId);

    const now = new Date();
    const today = startOfDay(now);
    const last = record.lastActiveDate ? startOfDay(record.lastActiveDate) : null;

    let currentStreak = record.currentStreak;
    if (last === null) currentStreak = 1;
    else if (last === today) currentStreak = Math.max(1, currentStreak);
    else if (today - last === DAY_MS) currentStreak += 1;
    else currentStreak = 1;

    const longestStreak = Math.max(record.longestStreak, currentStreak);
    const xp = record.xp + points;
    const level = levelForXp(xp);

    // Recomputed rather than incremented so a re-solve never double-counts.
    const solvedGroups = await this.prisma.submission.groupBy({
      by: ['problemId'],
      where: { userId, passed: true },
    });

    const updated = await this.prisma.gamification.update({
      where: { userId },
      data: {
        xp,
        level,
        currentStreak,
        longestStreak,
        lastActiveDate: now,
        problemsSolved: solvedGroups.length,
      },
    });

    const newBadges = await this.checkBadges(userId);

    if (level > record.level) {
      this.logger.log(`User ${userId} reached level ${level}`);
    }

    return {
      xp: updated.xp,
      xpAwarded: points,
      level: updated.level,
      leveledUp: level > record.level,
      currentStreak: updated.currentStreak,
      longestStreak: updated.longestStreak,
      problemsSolved: updated.problemsSolved,
      newBadges,
    };
  }

  // ── badges ─────────────────────────────────────────────────────────

  /** Evaluates every badge condition and awards the ones newly satisfied. */
  async checkBadges(userId: string): Promise<AwardResult['newBadges']> {
    const [record, badges, earned] = await Promise.all([
      this.ensureRecord(userId),
      this.prisma.badge.findMany(),
      this.prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    ]);

    const earnedIds = new Set(earned.map((e) => e.badgeId));
    const candidates = badges.filter((b) => !earnedIds.has(b.id));
    if (candidates.length === 0) return [];

    const needsRank = candidates.some(
      (b) => parseJson<BadgeCondition | null>(b.condition, null)?.type === 'leaderboard_rank',
    );
    const needsPerfect = candidates.some(
      (b) => parseJson<BadgeCondition | null>(b.condition, null)?.type === 'perfect_score',
    );
    const needsCategory = candidates.some(
      (b) => parseJson<BadgeCondition | null>(b.condition, null)?.type === 'category_master',
    );

    const rank = needsRank ? await this.globalRank(userId, record.xp) : Number.MAX_SAFE_INTEGER;
    const hasPerfect = needsPerfect
      ? (await this.prisma.submission.count({ where: { userId, passed: true, attemptNumber: 1 } })) > 0
      : false;
    const bestCategory = needsCategory ? await this.bestCategoryCount(userId) : 0;

    const awarded: AwardResult['newBadges'] = [];

    for (const badge of candidates) {
      const condition = parseJson<BadgeCondition | null>(badge.condition, null);
      if (!condition) continue;

      let qualifies = false;
      switch (condition.type) {
        case 'problems_solved':
          qualifies = record.problemsSolved >= condition.threshold;
          break;
        case 'streak':
          qualifies = Math.max(record.currentStreak, record.longestStreak) >= condition.threshold;
          break;
        case 'leaderboard_rank':
          qualifies = record.xp > 0 && rank <= condition.threshold;
          break;
        case 'perfect_score':
          qualifies = hasPerfect;
          break;
        case 'category_master':
          qualifies = bestCategory >= condition.threshold;
          break;
      }

      if (!qualifies) continue;

      try {
        await this.prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
        awarded.push({
          key: badge.key,
          name: badge.name,
          icon: badge.icon,
          description: badge.description,
        });
      } catch {
        // Unique constraint — awarded concurrently, nothing to do.
      }
    }

    return awarded;
  }

  private async globalRank(userId: string, xp: number): Promise<number> {
    const ahead = await this.prisma.gamification.count({
      where: { xp: { gt: xp }, user: { role: Role.STUDENT, isActive: true } },
    });
    void userId;
    return ahead + 1;
  }

  private async bestCategoryCount(userId: string): Promise<number> {
    const solved = await this.prisma.submission.findMany({
      where: { userId, passed: true },
      select: { problem: { select: { id: true, category: true } } },
      distinct: ['problemId'],
    });

    const counts = new Map<string, number>();
    for (const row of solved) {
      const category = row.problem.category;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return Math.max(0, ...counts.values());
  }

  // ── queries ────────────────────────────────────────────────────────

  async me(userId: string) {
    const record = await this.ensureRecord(userId);
    const badges = await this.prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });

    return {
      xp: record.xp,
      level: record.level,
      levelThresholds: [...LEVEL_THRESHOLDS],
      xpToNextLevel: xpToNextLevel(record.xp),
      currentStreak: record.currentStreak,
      longestStreak: record.longestStreak,
      lastActiveDate: record.lastActiveDate,
      problemsSolved: record.problemsSolved,
      rank: await this.globalRank(userId, record.xp),
      badges: badges.map((b) => ({
        key: b.badge.key,
        name: b.badge.name,
        description: b.badge.description,
        icon: b.badge.icon,
        earnedAt: b.earnedAt,
      })),
    };
  }

  async leaderboard(currentUserId: string, classId?: string, limit = 50): Promise<LeaderboardRow[]> {
    const rows = await this.prisma.gamification.findMany({
      where: {
        user: {
          role: Role.STUDENT,
          isActive: true,
          ...(classId ? { enrollments: { some: { classId } } } : {}),
        },
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
      orderBy: [{ xp: 'desc' }, { problemsSolved: 'desc' }],
      take: limit,
    });

    return rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      username: row.user.username,
      displayName: row.user.displayName,
      avatar: row.user.avatar,
      xp: row.xp,
      level: row.level,
      problemsSolved: row.problemsSolved,
      currentStreak: row.currentStreak,
      isCurrentUser: row.userId === currentUserId,
    }));
  }

  /** Every badge in the catalogue, flagged with whether this user has it. */
  async badges(userId: string) {
    const [all, earned] = await Promise.all([
      this.prisma.badge.findMany(),
      this.prisma.userBadge.findMany({ where: { userId } }),
    ]);

    const earnedByBadge = new Map(earned.map((e) => [e.badgeId, e.earnedAt]));
    const order = new Map(BADGE_DEFINITIONS.map((b, i) => [b.key, i]));

    return all
      .sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99))
      .map((badge) => ({
        key: badge.key,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        condition: parseJson<BadgeCondition | null>(badge.condition, null),
        earned: earnedByBadge.has(badge.id),
        earnedAt: earnedByBadge.get(badge.id) ?? null,
      }));
  }

  async statsFor(userId: string) {
    const record = await this.prisma.gamification.findUnique({ where: { userId } });
    if (!record) throw new NotFoundException('No gamification record for that user');
    return record;
  }
}
