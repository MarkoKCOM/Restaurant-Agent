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
