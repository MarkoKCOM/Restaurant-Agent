/**
 * OpenSeat API client — used by E2E tests and agent integrations.
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const envFile = resolve(repoRoot, ".env");

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const BASE_URL = process.env.OPENSEAT_API_URL || "http://localhost:3001";
const ADMIN_EMAIL = process.env.OPENSEAT_ADMIN_EMAIL || "admin@bff.co.il";
const ADMIN_PASSWORD = process.env.OPENSEAT_ADMIN_PASSWORD || process.env.ADMIN_SEED_PASSWORD || "";

let cachedToken: string | null = null;

async function request(path: string, opts: { method?: string; token?: string; body?: unknown; retry?: boolean } = {}) {
  const { method = "GET", token, body, retry = true } = opts;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh token on 401 and retry once
  if (res.status === 401 && token && retry) {
    cachedToken = null;
    const freshToken = await getToken();
    return request(path, { method, token: freshToken, body, retry: false });
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }

  return data as Record<string, unknown>;
}

export async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const result = await request("/api/v1/auth/login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    retry: false,
  });

  cachedToken = result.token as string;
  return cachedToken;
}

// ── Public endpoints (no auth) ──────────────────────

export async function healthCheck() {
  return request("/api/v1/health");
}

export async function listRestaurants() {
  return request("/api/v1/restaurants");
}

export async function getAvailability(restaurantId: string, date: string, partySize: number) {
  return request(`/api/v1/reservations/availability?restaurantId=${restaurantId}&date=${date}&partySize=${partySize}`);
}

export async function createReservation(data: {
  restaurantId: string;
  guestName: string;
  guestPhone: string;
  date: string;
  timeStart: string;
  partySize: number;
  notes?: string;
  source?: string;
}) {
  return request("/api/v1/reservations", { method: "POST", body: data });
}

export async function addToWaitlist(data: {
  restaurantId: string;
  guestName: string;
  guestPhone: string;
  date: string;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  partySize: number;
}) {
  return request("/api/v1/waitlist", { method: "POST", body: data });
}

// ── Auth-required endpoints ─────────────────────────

export async function listReservations(restaurantId: string, date: string) {
  const token = await getToken();
  return request(`/api/v1/reservations?restaurantId=${restaurantId}&date=${date}`, { token });
}

export async function updateReservation(id: string, data: Record<string, unknown>) {
  const token = await getToken();
  return request(`/api/v1/reservations/${id}`, { method: "PATCH", token, body: data });
}

export async function markNoShow(id: string) {
  const token = await getToken();
  return request(`/api/v1/reservations/${id}/no-show`, { method: "POST", token });
}

export async function cancelReservation(id: string) {
  const token = await getToken();
  return request(`/api/v1/reservations/${id}`, { method: "DELETE", token });
}

export async function createWalkIn(data: {
  restaurantId: string;
  guestName: string;
  guestPhone: string;
  date: string;
  timeStart: string;
  partySize: number;
  notes?: string;
  seatImmediately?: boolean;
}) {
  const token = await getToken();
  return request("/api/v1/reservations/walk-in", { method: "POST", token, body: data });
}

export async function listGuests(restaurantId: string) {
  const token = await getToken();
  return request(`/api/v1/guests?restaurantId=${restaurantId}`, { token });
}

export async function getGuestProfile(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/guests/${guestId}/full-profile`, { token });
}

export async function listWaitlist(restaurantId: string, date?: string) {
  const token = await getToken();
  const qs = date ? `?restaurantId=${restaurantId}&date=${date}` : `?restaurantId=${restaurantId}`;
  return request(`/api/v1/waitlist${qs}`, { token });
}

export async function removeFromWaitlist(id: string) {
  const token = await getToken();
  return request(`/api/v1/waitlist/${id}`, { method: "DELETE", token });
}

export async function getDashboard(restaurantId: string) {
  const token = await getToken();
  return request(`/api/v1/restaurants/${restaurantId}/dashboard`, { token });
}

export async function getTableStatus(restaurantId: string) {
  const token = await getToken();
  return request(`/api/v1/restaurants/${restaurantId}/table-status`, { token });
}

export async function getLoyaltyBalance(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/loyalty/${guestId}/balance`, { token });
}

export async function getMembershipSummary(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/loyalty/${guestId}/summary`, { token });
}

export async function createReward(data: {
  restaurantId: string;
  nameHe: string;
  nameEn?: string;
  description?: string;
  pointsCost: number;
}) {
  const token = await getToken();
  return request("/api/v1/loyalty/rewards", { method: "POST", token, body: data });
}

export async function claimReward(guestId: string, rewardId: string, body: { reservationId?: string } = {}) {
  const token = await getToken();
  return request(`/api/v1/loyalty/${guestId}/rewards/${rewardId}/claim`, { method: "POST", token, body });
}

export async function verifyRewardClaim(claimCode: string) {
  const token = await getToken();
  return request(`/api/v1/loyalty/claims/${claimCode}/verify`, { token });
}

export async function redeemRewardClaim(claimId: string) {
  const token = await getToken();
  return request(`/api/v1/loyalty/claims/${claimId}/redeem`, { method: "POST", token });
}

export async function updateMessagingPreferences(guestId: string, optedOutCampaigns: boolean) {
  const token = await getToken();
  return request(`/api/v1/loyalty/${guestId}/messaging-preferences`, {
    method: "PATCH",
    token,
    body: { optedOutCampaigns },
  });
}

export async function createVisit(data: {
  guestId: string;
  restaurantId: string;
  reservationId?: string;
  date: string;
  partySize: number;
  items?: Array<{ name: string; category: string; price?: number; rating?: number }>;
  totalSpend?: number;
  feedback?: string;
  rating?: number;
  channel?: string;
}) {
  const token = await getToken();
  return request("/api/v1/visits", { method: "POST", token, body: data });
}
