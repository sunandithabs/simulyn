/**
 * Badge catalogue. Seeded into the `Badge` table and evaluated by the
 * gamification service after every successful submission.
 */
export type BadgeConditionType =
  | 'problems_solved'
  | 'streak'
  | 'leaderboard_rank'
  | 'perfect_score'
  | 'category_master';

export interface BadgeCondition {
  type: BadgeConditionType;
  threshold: number;
  /** Only set for category_master — the problem category to master. */
  category?: string;
}

export interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  condition: BadgeCondition;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    key: 'first_solve',
    name: 'First Blood',
    description: 'Solve your very first problem.',
    icon: '🩸',
    condition: { type: 'problems_solved', threshold: 1 },
  },
  {
    key: 'streak_7',
    name: 'Week Warrior',
    description: 'Practice 7 days in a row.',
    icon: '🔥',
    condition: { type: 'streak', threshold: 7 },
  },
  {
    key: 'streak_21',
    name: 'Habit Forged',
    description: 'Practice 21 days in a row.',
    icon: '⚡',
    condition: { type: 'streak', threshold: 21 },
  },
  {
    key: 'top_10',
    name: 'Top Ten',
    description: 'Reach the top 10 of your class leaderboard.',
    icon: '🏆',
    condition: { type: 'leaderboard_rank', threshold: 10 },
  },
  {
    key: 'perfect_score',
    name: 'Flawless',
    description: 'Pass every test case on your first attempt.',
    icon: '💎',
    condition: { type: 'perfect_score', threshold: 1 },
  },
  {
    key: 'category_master',
    name: 'Category Master',
    description: 'Solve 10 problems within a single category.',
    icon: '🎓',
    condition: { type: 'category_master', threshold: 10 },
  },
];

export const BADGES_BY_KEY: Record<string, BadgeDefinition> = Object.fromEntries(
  BADGE_DEFINITIONS.map((b) => [b.key, b]),
);

/** XP required to reach each level. Index 0 => level 1. */
export const LEVEL_THRESHOLDS = [0, 500, 1500, 3500, 6000, 10000, 15000, 25000] as const;

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

/** XP still needed for the next level, or null when already at max level. */
export function xpToNextLevel(xp: number): number | null {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return null;
  return LEVEL_THRESHOLDS[level] - xp;
}
