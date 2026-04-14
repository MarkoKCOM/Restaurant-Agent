/**
 * OpenSeat API client — used by E2E tests and agent integrations.
 */

import { createHmac, randomUUID } from "node:crypto";
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
const SUPER_ADMIN_EMAIL = process.env.OPENSEAT_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_SEED_EMAIL || "";
const SUPER_ADMIN_PASSWORD = process.env.OPENSEAT_SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_SEED_PASSWORD || "";

let cachedToken: string | null = null;
let cachedSuperAdminToken: string | null = null;

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

export async function loginWithCredentials(email: string, password: string) {
  return request("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
    retry: false,
  });
}

export async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const result = await loginWithCredentials(ADMIN_EMAIL, ADMIN_PASSWORD);
  cachedToken = result.token as string;
  return cachedToken;
}

function base64Url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createSignedSuperAdminToken(): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("Missing JWT_SECRET for synthetic super-admin token");
  }

  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(JSON.stringify({
    id: randomUUID(),
    email: "synthetic-super-admin@openseat.local",
    restaurantId: null,
    role: "super_admin",
    iat: now,
    exp: now + 60 * 60,
  }));
  const signature = createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${header}.${payload}.${signature}`;
}

export async function getSuperAdminToken(): Promise<string> {
  if (cachedSuperAdminToken) return cachedSuperAdminToken;

  if (SUPER_ADMIN_EMAIL && SUPER_ADMIN_PASSWORD) {
    const result = await loginWithCredentials(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    cachedSuperAdminToken = result.token as string;
    return cachedSuperAdminToken;
  }

  cachedSuperAdminToken = createSignedSuperAdminToken();
  return cachedSuperAdminToken;
}

// ── Public endpoints (no auth) ──────────────────────

export async function signupRestaurant(data: {
  owner: { name: string; email: string; password: string };
  restaurant: {
    name: string;
    cuisineType?: string;
    phone?: string;
    address?: string;
    package: "starter" | "growth";
    locale: "he" | "en";
    timezone: string;
    operatingHours: Record<string, { open: string; close: string } | null>;
  };
  tables: Array<{ name: string; minSeats: number; maxSeats: number; zone?: string }>;
}) {
  return request("/api/v1/auth/signup", { method: "POST", body: data, retry: false });
}

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
  templateKey?: string;
  recommendedMoments?: string[];
  pitchHe?: string;
  pitchEn?: string;
}) {
  const token = await getToken();
  return request("/api/v1/loyalty/rewards", { method: "POST", token, body: data });
}

export async function updateReward(rewardId: string, data: Record<string, unknown>) {
  const token = await getToken();
  return request(`/api/v1/loyalty/rewards/${rewardId}`, { method: "PATCH", token, body: data });
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

// ── Additional endpoints ───────────────────────────

export async function getRestaurant(id: string) {
  return request(`/api/v1/restaurants/${id}`);
}

export async function updateRestaurant(id: string, data: Record<string, unknown>) {
  const token = await getToken();
  return request(`/api/v1/restaurants/${id}`, { method: "PATCH", token, body: data });
}

export async function getDailySummary(restaurantId: string) {
  const token = await getToken();
  return request(`/api/v1/restaurants/${restaurantId}/summary`, { token });
}

export async function getGuest(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/guests/${guestId}`, { token });
}

export async function createGuest(data: { restaurantId: string; name: string; phone: string; email?: string }) {
  const token = await getToken();
  return request("/api/v1/guests", { method: "POST", token, body: data });
}

export async function updateGuest(guestId: string, data: Record<string, unknown>) {
  const token = await getToken();
  return request(`/api/v1/guests/${guestId}`, { method: "PATCH", token, body: data });
}

export async function getGuestSentiment(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/guests/${guestId}/sentiment`, { token });
}

export async function autoTagGuest(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/guests/${guestId}/auto-tag`, { method: "POST", token });
}

export async function listAdminRestaurants() {
  const token = await getSuperAdminToken();
  return request("/api/v1/admin/restaurants", { token });
}

export async function listTables(restaurantId: string) {
  const token = await getToken();
  return request(`/api/v1/tables?restaurantId=${restaurantId}`, { token });
}

export async function listTablesWithToken(restaurantId: string, token: string) {
  return request(`/api/v1/tables?restaurantId=${restaurantId}`, { token, retry: false });
}

export async function createTable(data: { restaurantId: string; name: string; minSeats: number; maxSeats: number }) {
  const token = await getToken();
  return request("/api/v1/tables", { method: "POST", token, body: data });
}

export async function updateTable(id: string, data: Record<string, unknown>) {
  const token = await getToken();
  return request(`/api/v1/tables/${id}`, { method: "PATCH", token, body: data });
}

export async function deleteTable(id: string) {
  const token = await getToken();
  return request(`/api/v1/tables/${id}`, { method: "DELETE", token });
}

export async function offerWaitlistSlot(id: string) {
  const token = await getToken();
  return request(`/api/v1/waitlist/${id}/offer`, { method: "POST", token });
}

export async function acceptWaitlistOffer(id: string) {
  return request(`/api/v1/waitlist/${id}/accept`, { method: "POST" });
}

export async function awardPoints(guestId: string, data: { restaurantId: string; points: number; reason: string }) {
  const token = await getToken();
  return request(`/api/v1/loyalty/${guestId}/award`, { method: "POST", token, body: data });
}

export async function getLoyaltyHistory(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/loyalty/${guestId}/history`, { token });
}

export async function listRewards(restaurantId: string) {
  const token = await getToken();
  return request(`/api/v1/loyalty/rewards?restaurantId=${restaurantId}`, { token });
}

export async function getStampCard(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/loyalty/${guestId}/stamp-card`, { token });
}

export async function getVisitHistory(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/visits/${guestId}`, { token });
}

export async function submitFeedback(data: {
  guestId: string;
  restaurantId: string;
  rating: number;
  feedback?: string;
  channel: string;
}) {
  return request("/api/v1/feedback", { method: "POST", body: data });
}

export async function getFeedbackSummary(restaurantId: string) {
  const token = await getToken();
  return request(`/api/v1/feedback/summary?restaurantId=${restaurantId}`, { token });
}

export async function generateReferralCode(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/gamification/${guestId}/referral-code`, { method: "POST", token });
}

export async function applyReferral(data: { guestId: string; referralCode: string }) {
  const token = await getToken();
  return request("/api/v1/gamification/apply-referral", { method: "POST", token, body: data });
}

export async function getReferralStats(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/gamification/${guestId}/referral-stats`, { token });
}

export async function listChallenges(restaurantId: string) {
  const token = await getToken();
  return request(`/api/v1/gamification/challenges?restaurantId=${restaurantId}`, { token });
}

export async function createChallenge(data: {
  restaurantId: string;
  name: string;
  type: string;
  target: number;
  reward: number;
}) {
  const token = await getToken();
  return request("/api/v1/gamification/challenges", { method: "POST", token, body: data });
}

export async function getGuestChallenges(guestId: string, restaurantId: string) {
  const token = await getToken();
  return request(`/api/v1/gamification/${guestId}/challenges?restaurantId=${restaurantId}`, { token });
}

export async function incrementChallenge(guestId: string, challengeId: string) {
  const token = await getToken();
  return request(`/api/v1/gamification/${guestId}/challenges/${challengeId}/increment`, { method: "POST", token });
}

export async function getStreak(guestId: string) {
  const token = await getToken();
  return request(`/api/v1/gamification/${guestId}/streak`, { token });
}

export async function listEngagementJobs(restaurantId: string) {
  const token = await getToken();
  return request(`/api/v1/engagement/jobs?restaurantId=${restaurantId}`, { token });
}

export async function triggerWinBack(restaurantId: string) {
  const token = await getToken();
  return request(`/api/v1/engagement/win-back/check?restaurantId=${restaurantId}`, { method: "POST", token });
}

export async function getAdminRestaurants() {
  const token = await getToken();
  return request("/api/v1/admin/restaurants", { token });
}
