import { guestRepository } from "../repositories/guest.repository.js";
import { restaurantRepository, type RestaurantRow } from "../repositories/restaurant.repository.js";
import { getAchievementsFromPreferences } from "./achievement.service.js";
import { getStreak } from "./challenge.service.js";
import { currentLeaderboardPeriod, getGuestLeaderboardRank } from "./leaderboard.service.js";

export type ShareTemplateMoment =
  | "achievement"
  | "tier_promotion"
  | "challenge_completion"
  | "streak_milestone"
  | "leaderboard_rank"
  | "birthday_week";

export interface ShareTemplate {
  key: string;
  moment: ShareTemplateMoment;
  eligible: boolean;
  title: {
    he: string;
    en: string;
  };
  subtitle: {
    he: string;
    en: string;
  };
  shareText: {
    he: string;
    en: string;
  };
  image: {
    format: "story";
    aspectRatio: "9:16";
    backgroundColor: string;
    accentColor: string;
    logoUrl: string | null;
    headline: string;
    subline: string;
    footer: string;
    badgeLabel: string;
  };
  cta: {
    he: string;
    en: string;
  };
}

export interface ShareTemplateSet {
  guestId: string;
  restaurantId: string;
  restaurantName: string;
  branding: {
    primaryColor: string;
    surfaceColor: string;
    logoUrl: string | null;
    tagline: string | null;
  };
  templates: ShareTemplate[];
}

interface ShareTemplateOptions {
  moment?: ShareTemplateMoment;
  achievementKey?: string;
  challengeName?: string;
}

function dashboardConfigObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nestedObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getBranding(restaurant: RestaurantRow): ShareTemplateSet["branding"] {
  const dashboardConfig = dashboardConfigObject(restaurant.dashboardConfig);
  const widgetConfig = dashboardConfigObject(restaurant.widgetConfig);
  const palette = nestedObject(dashboardConfig.palette);
  const branding = nestedObject(dashboardConfig.branding);

  return {
    primaryColor: stringField(palette.primary) ?? stringField(dashboardConfig.accentColor) ?? "#0f766e",
    surfaceColor: stringField(palette.surface) ?? "#f8fafc",
    logoUrl: stringField(branding.logo) ?? stringField(dashboardConfig.logo) ?? stringField(widgetConfig.logo),
    tagline: stringField(branding.tagline),
  };
}

function buildTemplate(params: {
  key: string;
  moment: ShareTemplateMoment;
  restaurantName: string;
  guestName: string;
  branding: ShareTemplateSet["branding"];
  titleHe: string;
  titleEn: string;
  subtitleHe: string;
  subtitleEn: string;
  badgeLabel: string;
  ctaHe?: string;
  ctaEn?: string;
}): ShareTemplate {
  const footer = params.branding.tagline ?? params.restaurantName;

  return {
    key: params.key,
    moment: params.moment,
    eligible: true,
    title: {
      he: params.titleHe,
      en: params.titleEn,
    },
    subtitle: {
      he: params.subtitleHe,
      en: params.subtitleEn,
    },
    shareText: {
      he: `${params.titleHe} ${params.subtitleHe} ${params.restaurantName}`,
      en: `${params.titleEn} ${params.subtitleEn} ${params.restaurantName}`,
    },
    image: {
      format: "story",
      aspectRatio: "9:16",
      backgroundColor: params.branding.surfaceColor,
      accentColor: params.branding.primaryColor,
      logoUrl: params.branding.logoUrl,
      headline: params.titleEn,
      subline: `${params.guestName} at ${params.restaurantName}`,
      footer,
      badgeLabel: params.badgeLabel,
    },
    cta: {
      he: params.ctaHe ?? "שתפו את הרגע",
      en: params.ctaEn ?? "Share the moment",
    },
  };
}

export async function getGuestShareTemplates(
  guestId: string,
  options: ShareTemplateOptions = {},
): Promise<ShareTemplateSet | null> {
  const guest = await guestRepository.findById(guestId);
  if (!guest) return null;
  const restaurant = await restaurantRepository.findById(guest.restaurantId);
  if (!restaurant) return null;
  const branding = getBranding(restaurant);
  const preferences = nestedObject(guest.preferences);
  const achievements = getAchievementsFromPreferences(guest.preferences);
  const selectedAchievement = options.achievementKey
    ? achievements.badges.find((badge) => badge.key === options.achievementKey)
    : achievements.badges.at(-1);

  const [streak, leaderboardRank] = await Promise.all([
    getStreak(guestId),
    getGuestLeaderboardRank(guestId, guest.restaurantId),
  ]);

  const templates: ShareTemplate[] = [];

  if (selectedAchievement) {
    templates.push(buildTemplate({
      key: `achievement:${selectedAchievement.key}`,
      moment: "achievement",
      restaurantName: restaurant.name,
      guestName: guest.name,
      branding,
      titleHe: selectedAchievement.nameHe,
      titleEn: selectedAchievement.nameEn,
      subtitleHe: selectedAchievement.descriptionHe,
      subtitleEn: selectedAchievement.descriptionEn,
      badgeLabel: "Achievement",
    }));
  }

  if (guest.tier && guest.tier !== "bronze") {
    const tierName = guest.tier === "gold" ? "Gold" : "Silver";
    templates.push(buildTemplate({
      key: `tier:${guest.tier}`,
      moment: "tier_promotion",
      restaurantName: restaurant.name,
      guestName: guest.name,
      branding,
      titleHe: `עליתי ל-${tierName}`,
      titleEn: `${tierName} member unlocked`,
      subtitleHe: `חברות המועדון של ${restaurant.name} משתדרגת.`,
      subtitleEn: `${guest.name} just reached ${tierName} status.`,
      badgeLabel: `${tierName} Tier`,
    }));
  }

  if (options.challengeName) {
    templates.push(buildTemplate({
      key: "challenge:completion",
      moment: "challenge_completion",
      restaurantName: restaurant.name,
      guestName: guest.name,
      branding,
      titleHe: "אתגר הושלם",
      titleEn: "Challenge completed",
      subtitleHe: `${options.challengeName} הושלם בהצלחה.`,
      subtitleEn: `${options.challengeName} is complete.`,
      badgeLabel: "Challenge",
    }));
  }

  if (streak.current >= 3) {
    templates.push(buildTemplate({
      key: `streak:${streak.current}`,
      moment: "streak_milestone",
      restaurantName: restaurant.name,
      guestName: guest.name,
      branding,
      titleHe: `${streak.current} שבועות ברצף`,
      titleEn: `${streak.current}-week streak`,
      subtitleHe: `רצף ביקורים פעיל אצל ${restaurant.name}.`,
      subtitleEn: `${guest.name} is on a ${streak.current}-week visit streak.`,
      badgeLabel: "Streak",
    }));
  }

  if (leaderboardRank) {
    templates.push(buildTemplate({
      key: `leaderboard:${currentLeaderboardPeriod()}:${leaderboardRank.rank}`,
      moment: "leaderboard_rank",
      restaurantName: restaurant.name,
      guestName: guest.name,
      branding,
      titleHe: `מקום ${leaderboardRank.rank} בלוח המובילים`,
      titleEn: `Leaderboard rank #${leaderboardRank.rank}`,
      subtitleHe: `${leaderboardRank.pointsEarned} נקודות החודש.`,
      subtitleEn: `${leaderboardRank.pointsEarned} points earned this month.`,
      badgeLabel: "Leaderboard",
    }));
  }

  if (stringField(preferences.birthday)) {
    templates.push(buildTemplate({
      key: "birthday_week:ready",
      moment: "birthday_week",
      restaurantName: restaurant.name,
      guestName: guest.name,
      branding,
      titleHe: "שבוע יום הולדת במסעדה",
      titleEn: "Birthday week treat",
      subtitleHe: `חוגגים אצל ${restaurant.name} עם הטבה מיוחדת.`,
      subtitleEn: `Celebrating birthday week at ${restaurant.name}.`,
      badgeLabel: "Birthday",
    }));
  }

  const filteredTemplates = options.moment
    ? templates.filter((template) => template.moment === options.moment)
    : templates;

  return {
    guestId,
    restaurantId: guest.restaurantId,
    restaurantName: restaurant.name,
    branding,
    templates: filteredTemplates,
  };
}
