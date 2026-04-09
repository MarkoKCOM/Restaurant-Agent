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

export interface DashboardConfig {
  // ── Legacy fields — kept for backward compatibility ──
  /** @deprecated Use palette.primary instead. */
  accentColor?: string;
  /** @deprecated Use branding.logo instead. */
  logo?: string;

  // ── Structured brand kit ──
  palette?: DashboardPalette;
  branding?: DashboardBranding;

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

export interface StreakSummary {
  current: number;
  best: number;
  lastVisitWeek: string;
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
  optedOutCampaigns: boolean;
}
