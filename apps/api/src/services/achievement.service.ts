import { guestRepository } from "../repositories/guest.repository.js";

export interface AchievementBadge {
  key: string;
  nameHe: string;
  nameEn: string;
  descriptionHe: string;
  descriptionEn: string;
  unlockedAt: string;
}

export interface AchievementSummary {
  badges: AchievementBadge[];
  count: number;
}

type VisitItem = { name: string; category: string };

const ACHIEVEMENT_DEFINITIONS = [
  {
    key: "first_visit",
    nameHe: "ביקור ראשון",
    nameEn: "First visit",
    descriptionHe: "החבר השלים ביקור ראשון במסעדה.",
    descriptionEn: "Member completed their first visit.",
    earned: (input: AchievementInput) => input.visitCount >= 1,
  },
  {
    key: "ten_visits",
    nameHe: "10 ביקורים",
    nameEn: "10 visits",
    descriptionHe: "החבר הגיע ל-10 ביקורים.",
    descriptionEn: "Member reached 10 visits.",
    earned: (input: AchievementInput) => input.visitCount >= 10,
  },
  {
    key: "tasting_menu",
    nameHe: "תפריט טעימות",
    nameEn: "Tasting menu",
    descriptionHe: "החבר ניסה תפריט טעימות.",
    descriptionEn: "Member tried a tasting menu.",
    earned: (input: AchievementInput) => input.items.some(isTastingMenuItem),
  },
] as const;

interface AchievementInput {
  visitCount: number;
  items: VisitItem[];
}

function parseGuestPreferences(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseAchievementBadge(value: unknown): AchievementBadge | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<AchievementBadge>;
  if (
    typeof item.key !== "string"
    || typeof item.nameHe !== "string"
    || typeof item.nameEn !== "string"
    || typeof item.descriptionHe !== "string"
    || typeof item.descriptionEn !== "string"
  ) {
    return null;
  }

  return {
    key: item.key,
    nameHe: item.nameHe,
    nameEn: item.nameEn,
    descriptionHe: item.descriptionHe,
    descriptionEn: item.descriptionEn,
    unlockedAt: typeof item.unlockedAt === "string" ? item.unlockedAt : new Date(0).toISOString(),
  };
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function isTastingMenuItem(item: VisitItem): boolean {
  const name = normalizeText(item.name);
  const category = normalizeText(item.category);
  return name.includes("tasting menu")
    || category.includes("tasting menu")
    || category.includes("טעימות")
    || name.includes("טעימות");
}

export function getAchievementsFromPreferences(preferences: unknown): AchievementSummary {
  const parsed = parseGuestPreferences(preferences);
  const rawAchievements = parsed.achievements;
  const achievements = rawAchievements && typeof rawAchievements === "object" && !Array.isArray(rawAchievements)
    ? rawAchievements as Record<string, unknown>
    : {};
  const badges = Array.isArray(achievements.badges)
    ? achievements.badges.flatMap((badge) => {
      const parsedBadge = parseAchievementBadge(badge);
      return parsedBadge ? [parsedBadge] : [];
    })
    : [];

  return {
    badges,
    count: badges.length,
  };
}

export function applyVisitAchievements(
  preferences: unknown,
  input: AchievementInput,
): { preferences: Record<string, unknown>; achievements: AchievementSummary; changed: boolean } {
  const prefs = parseGuestPreferences(preferences);
  const existing = getAchievementsFromPreferences(prefs);
  const badgesByKey = new Map(existing.badges.map((badge) => [badge.key, badge]));
  const now = new Date().toISOString();

  for (const definition of ACHIEVEMENT_DEFINITIONS) {
    if (!definition.earned(input) || badgesByKey.has(definition.key)) continue;
    badgesByKey.set(definition.key, {
      key: definition.key,
      nameHe: definition.nameHe,
      nameEn: definition.nameEn,
      descriptionHe: definition.descriptionHe,
      descriptionEn: definition.descriptionEn,
      unlockedAt: now,
    });
  }

  const badges = [...badgesByKey.values()].sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt));
  const achievements = {
    badges,
    count: badges.length,
  };
  const changed =
    badges.length !== existing.badges.length
    || badges.some((badge, index) => badge.key !== existing.badges[index]?.key);

  return {
    preferences: {
      ...prefs,
      achievements,
    },
    achievements,
    changed,
  };
}

export async function awardVisitAchievements(
  guestId: string,
  input: { visitCount?: number; items?: VisitItem[] } = {},
): Promise<AchievementSummary | null> {
  const guest = await guestRepository.findById(guestId);

  if (!guest) return null;

  const result = applyVisitAchievements(guest.preferences, {
    visitCount: input.visitCount ?? guest.visitCount,
    items: input.items ?? [],
  });

  if (result.changed) {
    await guestRepository.updateById(guestId, {
      preferences: result.preferences,
      updatedAt: new Date(),
    });
  }

  return result.achievements;
}
