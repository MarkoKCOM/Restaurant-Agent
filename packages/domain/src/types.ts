import type { RewardMomentKey } from "./reward-templates.js";

// Core domain types shared across all apps

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  cuisineType?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  timezone: string;
  locale: string;
  operatingHours?: OperatingHours;
  package: "starter" | "growth";
  widgetConfig?: WidgetConfig;
  dashboardConfig?: DashboardConfig;
}

export interface OperatingHours {
  [day: string]: { open: string; close: string } | null;
}

export interface WidgetConfig {
  primaryColor?: string;
  logo?: string;
  welcomeText?: string;
}

export interface DashboardPalette {
  /** Primary brand color — buttons, active nav items, key accents. */
  primary?: string;
  /** Sidebar background color. */
  sidebar?: string;
  /** Sidebar text/icon color. */
  sidebarText?: string;
  /** Surface/card accent background (e.g. stat cards). */
  surface?: string;
  /** Secondary accent (e.g. badges, hover states). */
  accent?: string;
}

export interface DashboardBranding {
  /** Square logo / icon URL shown in sidebar header. */
  logo?: string;
  /** Text-based wordmark URL shown in sidebar (optional). */
  wordmark?: string;
  /** Short tagline shown beneath restaurant name in sidebar. */
  tagline?: string;
}

export interface DashboardLoyaltyOffPeakMultiplier {
  label?: string;
  start: string;
  end: string;
  multiplier: number;
  days?: Array<"sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat">;
  enabled?: boolean;
}

export interface DashboardLoyaltyConfig {
  offPeakMultipliers?: DashboardLoyaltyOffPeakMultiplier[];
}

export interface DashboardEngagementQuietHoursConfig {
  enabled?: boolean;
  start: string;
  end: string;
}

export interface DashboardEngagementConfig {
  quietHours?: DashboardEngagementQuietHoursConfig;
}

export interface DashboardLuckySpinPrize {
  key: string;
  labelHe?: string;
  labelEn?: string;
  points: number;
  weight: number;
  enabled?: boolean;
}

export interface DashboardLuckySpinConfig {
  enabled?: boolean;
  triggerEvery?: number;
  prizePool?: DashboardLuckySpinPrize[];
}

export interface DashboardGamificationConfig {
  luckySpin?: DashboardLuckySpinConfig;
}

export interface DashboardConfig {
  // ── Legacy fields — kept for backward compatibility ──
  /** @deprecated Use palette.primary instead. */
  accentColor?: string;
  /** @deprecated Use branding.logo instead. */
  logo?: string;

  // ── Structured brand kit ──
  palette?: DashboardPalette;
  branding?: DashboardBranding;
  loyalty?: DashboardLoyaltyConfig;
  engagement?: DashboardEngagementConfig;
  gamification?: DashboardGamificationConfig;

  language?: "he" | "en";
  visiblePages?: string[];
  features?: {
    waitlist?: boolean;
    loyalty?: boolean;
    guestNotes?: boolean;
    occupancyHeatmap?: boolean;
    tableMap?: boolean;
  };
}

export interface Table {
  id: string;
  restaurantId: string;
  name: string;
  minSeats: number;
  maxSeats: number;
  zone?: string;
  combinableWith?: string[];
  isActive: boolean;
}

export interface GuestPreferences {
  dietary: string[];
  seating: string;
  language: string;
  notes: string;
  hospitalitySignals?: string[];
  hospitalityNote?: string;
}

export interface Guest {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  email?: string;
  language: "he" | "en" | "ar" | "ru";
  source: "whatsapp" | "web" | "walk_in" | "referral" | "telegram";
  visitCount: number;
  noShowCount: number;
  tier: "bronze" | "silver" | "gold";
  preferences?: GuestPreferences | Record<string, unknown>;
  tags?: string[];
  notes?: string;
  optedOutCampaigns?: boolean;
  referralCode?: string;
  referredBy?: string;
}

export interface Reservation {
  id: string;
  restaurantId: string;
  guestId: string;
  date: string;
  timeStart: string;
  timeEnd?: string;
  partySize: number;
  tableIds?: string[];
  status: ReservationStatus;
  source: "whatsapp" | "web" | "walk_in" | "phone" | "telegram";
  notes?: string;
  guest?: Guest;
  confirmedAt?: string;
  seatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  noShowAt?: string;
}

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

export interface WaitlistEntry {
  id: string;
  restaurantId: string;
  guestId: string;
  date: string;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  partySize: number;
  status: "waiting" | "offered" | "accepted" | "expired";
}

export interface AvailabilitySlot {
  time: string;
  availableTables: number;
  maxPartySize: number;
}

export interface DashboardSnapshot {
  today: {
    reservations: number;
    covers: number;
    cancellations: number;
    noShows: number;
  };
  upcoming: Reservation[];
  occupancyByHour: Record<string, number>;
}

export type RewardClaimStatus = "active" | "redeemed" | "expired" | "cancelled";

export interface RewardCatalogItem {
  id: string;
  nameHe: string;
  nameEn?: string;
  description?: string;
  pointsCost: number;
  claimable: boolean;
  pointsShortfall: number;
  templateKey?: string | null;
  recommendedMoments?: RewardMomentKey[] | null;
  pitchHe?: string | null;
  pitchEn?: string | null;
}

export interface RewardClaim {
  id: string;
  rewardId: string;
  rewardName: string;
  claimCode: string;
  status: RewardClaimStatus;
  claimedAt: string;
  redeemedAt?: string;
  reservationId?: string;
}

export interface ReferralSummary {
  referralCode?: string;
  referredBy?: string;
  referralCount: number;
  totalReferralPoints: number;
}

export interface ReferralShare {
  guestId: string;
  restaurantId: string;
  referralCode: string;
  referralCount: number;
  totalReferralPoints: number;
  benefitSummary: {
    he: string;
    en: string;
  };
  shareMessage: {
    he: string;
    en: string;
  };
}

export interface StreakSummary {
  current: number;
  best: number;
  lastVisitWeek: string;
}

export interface MenuExplorationBadge {
  key: string;
  nameHe: string;
  nameEn: string;
  unlockedAt: string;
}

export interface MenuExplorationSummary {
  categoriesTried: string[];
  categoryCount: number;
  badges: MenuExplorationBadge[];
}

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

export interface LeaderboardMemberSummary {
  optedIn: boolean;
  optedInAt?: string;
  rank: number | null;
  pointsEarned: number | null;
  period: string | null;
}

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

export interface MembershipSummary {
  guestId: string;
  restaurantId: string;
  loyalty: {
    pointsBalance: number;
    tier: "bronze" | "silver" | "gold";
    visitCount: number;
    noShowCount: number;
    stampCard: {
      visits: number;
      stampsNeeded: number;
      stampsUntilReward: number;
      earned: number;
    } | null;
  };
  rewards: {
    available: RewardCatalogItem[];
  };
  claims: {
    active: RewardClaim[];
    past: RewardClaim[];
  };
  referrals: ReferralSummary;
  streak: StreakSummary;
  menuExploration: MenuExplorationSummary;
  achievements: AchievementSummary;
  leaderboard: LeaderboardMemberSummary;
  luckySpin: {
    enabled: boolean;
    triggerEvery: number;
    nextEligibleVisit: number | null;
    lastPrize: {
      key: string;
      points: number;
      awardedAt: string;
      reservationId: string | null;
    } | null;
  };
  shareTemplates: ShareTemplate[];
  optedOutCampaigns: boolean;
}
