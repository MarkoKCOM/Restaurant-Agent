import { describe, it, expect } from "vitest";

import type { DashboardConfig } from "./types.js";
import {
  DASHBOARD_ACCESS_BY_ROLE,
  DEFAULT_FEATURES,
  isFeatureEnabled,
  isPageVisible,
} from "./dashboard-access.js";

describe("isFeatureEnabled", () => {
  it("falls back to defaults when the restaurant has no config", () => {
    expect(isFeatureEnabled("loyalty", undefined)).toBe(DEFAULT_FEATURES.loyalty);
    expect(isFeatureEnabled("waitlist", undefined)).toBe(DEFAULT_FEATURES.waitlist);
  });

  it("falls back to defaults when features object is absent", () => {
    const config = {} as DashboardConfig;
    expect(isFeatureEnabled("loyalty", config)).toBe(DEFAULT_FEATURES.loyalty);
  });

  it("respects an explicit false override", () => {
    const config = { features: { loyalty: false } } as DashboardConfig;
    expect(isFeatureEnabled("loyalty", config)).toBe(false);
  });

  it("respects an explicit true override", () => {
    const config = { features: { waitlist: true } } as DashboardConfig;
    expect(isFeatureEnabled("waitlist", config)).toBe(true);
  });

  it("falls back to the default when a single feature is undefined", () => {
    const config = { features: { waitlist: true } } as DashboardConfig;
    // loyalty is not specified -> default
    expect(isFeatureEnabled("loyalty", config)).toBe(DEFAULT_FEATURES.loyalty);
  });
});

describe("isPageVisible", () => {
  const adminAccess = DASHBOARD_ACCESS_BY_ROLE.admin;
  const employeeAccess = DASHBOARD_ACCESS_BY_ROLE.employee;
  const superAdminAccess = DASHBOARD_ACCESS_BY_ROLE.super_admin;

  it("hides pages the role does not grant", () => {
    // employees have no analytics page
    expect(isPageVisible("analytics", employeeAccess, undefined, "employee")).toBe(false);
  });

  it("shows role-granted pages with no restaurant config", () => {
    expect(isPageVisible("reservations", adminAccess, undefined, "admin")).toBe(true);
  });

  it("gates the loyalty page on the loyalty feature, not visiblePages", () => {
    const loyaltyOff = { features: { loyalty: false } } as DashboardConfig;
    expect(isPageVisible("loyalty", adminAccess, loyaltyOff, "admin")).toBe(false);

    const loyaltyOn = { features: { loyalty: true } } as DashboardConfig;
    expect(isPageVisible("loyalty", adminAccess, loyaltyOn, "admin")).toBe(true);
  });

  it("lets super_admin bypass per-restaurant visiblePages", () => {
    const restrictive = { visiblePages: ["today"] } as DashboardConfig;
    // guests is not in visiblePages, but super_admin bypasses tenant visibility
    expect(isPageVisible("guests", superAdminAccess, restrictive, "super_admin")).toBe(true);
  });

  it("intersects role access with a restaurant's configured visiblePages for non-super-admins", () => {
    const restrictive = { visiblePages: ["today", "reservations"] } as DashboardConfig;
    expect(isPageVisible("today", adminAccess, restrictive, "admin")).toBe(true);
    // settings is role-granted for admin but excluded by the restaurant config
    expect(isPageVisible("settings", adminAccess, restrictive, "admin")).toBe(false);
  });
});
