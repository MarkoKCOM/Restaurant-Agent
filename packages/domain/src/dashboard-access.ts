import type { DashboardConfig } from "./types.js";

export type DashboardRole = "admin" | "employee" | "super_admin";

export type DashboardPageKey =
  | "restaurants"
  | "today"
  | "reservations"
  | "waitlist"
  | "guests"
  | "settings"
  | "help";

export interface DashboardAccess {
  pages: DashboardPageKey[];
  actions: string[];
}

// ── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_VISIBLE_PAGES: DashboardPageKey[] = [
  "today",
  "reservations",
  "waitlist",
  "guests",
  "settings",
  "help",
];

export const DEFAULT_FEATURES: Required<NonNullable<DashboardConfig["features"]>> = {
  waitlist: true,
  loyalty: true,
  guestNotes: true,
  occupancyHeatmap: true,
  tableMap: true,
};

// ── Visibility helpers ─────────────────────────────────────────────────────

/**
 * Returns true if the given page should be visible for this user.
 * Intersects role-based access with restaurant-configured visiblePages.
 * Super-admin is never blocked by per-restaurant visiblePages.
 */
export function isPageVisible(
  page: DashboardPageKey,
  access: DashboardAccess,
  config: DashboardConfig | undefined,
  role: DashboardRole,
): boolean {
  // Role must allow the page first.
  if (!access.pages.includes(page)) return false;
  // Super-admin bypasses tenant-level visibility.
  if (role === "super_admin") return true;
  // If restaurant has configured visiblePages, intersect with that list.
  const visiblePages = config?.visiblePages ?? DEFAULT_VISIBLE_PAGES;
  return visiblePages.includes(page);
}

/**
 * Returns true if the given feature is enabled for this restaurant.
 * Falls back to DEFAULT_FEATURES when restaurant has no config.
 */
export function isFeatureEnabled(
  feature: keyof typeof DEFAULT_FEATURES,
  config: DashboardConfig | undefined,
): boolean {
  const features = config?.features;
  if (!features) return DEFAULT_FEATURES[feature];
  const val = features[feature];
  return val === undefined ? DEFAULT_FEATURES[feature] : val;
}

export const DASHBOARD_ACCESS_BY_ROLE: Record<DashboardRole, DashboardAccess> = {
  admin: {
    pages: ["today", "reservations", "waitlist", "guests", "settings", "help"],
    actions: [
      "reservation.manage",
      "walkin.create",
      "waitlist.manage",
      "guest.manage",
      "settings.manage",
      "loyalty.verify",
      "loyalty.redeem",
      "loyalty.reward.manage",
      "loyalty.points.adjust",
    ],
  },
  employee: {
    pages: ["today", "reservations", "waitlist"],
    actions: ["reservation.manage", "walkin.create", "waitlist.manage", "loyalty.verify", "loyalty.redeem"],
  },
  super_admin: {
    pages: ["restaurants", "today", "reservations", "waitlist", "guests", "settings", "help"],
    actions: [
      "reservation.manage",
      "walkin.create",
      "waitlist.manage",
      "guest.manage",
      "settings.manage",
      "restaurant.switch",
      "loyalty.verify",
      "loyalty.redeem",
      "loyalty.reward.manage",
      "loyalty.points.adjust",
    ],
  },
};
