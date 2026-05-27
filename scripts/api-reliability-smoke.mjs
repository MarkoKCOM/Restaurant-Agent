#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const baseUrl = (
  process.argv[2] ||
  process.env.OPENSEAT_API_URL ||
  process.env.SABLE_API_URL ||
  "http://localhost:3001"
).replace(/\/$/, "");
const adminEmail =
  process.env.OPENSEAT_ADMIN_EMAIL ||
  process.env.SABLE_ADMIN_EMAIL ||
  process.env.ADMIN_EMAIL ||
  "admin@bff.co.il";
const adminPassword =
  process.env.OPENSEAT_ADMIN_PASSWORD ||
  process.env.SABLE_ADMIN_PASSWORD ||
  process.env.ADMIN_SEED_PASSWORD;

if (!adminPassword) {
  console.error(
    "Missing OPENSEAT_ADMIN_PASSWORD, SABLE_ADMIN_PASSWORD, or ADMIN_SEED_PASSWORD in environment",
  );
  process.exit(1);
}

async function request(path, { method = "GET", token, body } = {}) {
  const requestId = `${runId}-${++requestSeq}`;
  const startedAt = Date.now();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-request-id": requestId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const elapsedMs = Date.now() - startedAt;
  const responseRequestId = res.headers.get("x-request-id");

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  report.requests.push({
    method,
    path,
    status: res.status,
    ok: res.ok,
    elapsedMs,
    requestId,
    responseRequestId,
    code: typeof data === "object" && data !== null ? data.code : undefined,
  });

  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${res.statusText} requestId=${requestId}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }

  return data;
}

function plusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function previousIsoWeek() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return isoWeek(d);
}

function isoWeekWeeksAgo(weeksAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - weeksAgo * 7);
  return isoWeek(d);
}

function timePlusMinutes(value, minutesToAdd) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  const total = (hours * 60 + minutes + minutesToAdd) % (24 * 60);
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

function timeInJerusalemPlusMinutes(minutesToAdd) {
  const date = new Date(Date.now() + minutesToAdd * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  return `${hour}:${minute}`;
}

function minutesFromHHMM(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isTimeInWindow(value, start, end) {
  const time = minutesFromHHMM(value);
  const startMinutes = minutesFromHHMM(start);
  const endMinutes = minutesFromHHMM(end);
  if (startMinutes === endMinutes) return false;
  return startMinutes < endMinutes
    ? time >= startMinutes && time < endMinutes
    : time >= startMinutes || time < endMinutes;
}

function timeInJerusalem(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  return `${hour}:${minute}`;
}

function dayKeyForDate(value) {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${value}T12:00:00`).getDay()];
}

function jerusalemDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return { year, month, day };
}

function jerusalemMonthDay() {
  const { month, day } = jerusalemDateParts();
  return `${month}-${day}`;
}

function jerusalemMonthDayPlusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const { month, day } = jerusalemDateParts(date);
  return `${month}-${day}`;
}

function lastYearJerusalemDate() {
  const { year, month, day } = jerusalemDateParts();
  return `${Number(year) - 1}-${month}-${day}`;
}

const runId = `smoke-${Date.now()}`;
let reservationDate = plusDays(10);
const visitDate = plusDays(0);

const report = {
  baseUrl,
  runId,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  status: "running",
  steps: [],
  requests: [],
};
let requestSeq = 0;
const cleanupTasks = [];

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function record(step, details) {
  report.steps.push({ step, ...details });
}

async function markSmokeEngagementJobSent(jobId, type = "thank_you") {
  if (!process.env.DATABASE_URL) return false;
  if (!isUuid(jobId)) {
    throw new Error(`Refusing to cleanup invalid engagement job id: ${jobId}`);
  }
  if (!["thank_you", "review_request", "leaderboard_summary", "lucky_spin_reward", "challenge_completion", "streak_broken"].includes(type)) {
    throw new Error(`Refusing to cleanup unsupported engagement job type: ${type}`);
  }

  await execFileAsync("psql", [
    process.env.DATABASE_URL,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `update engagement_jobs set status = 'sent', sent_at = now(), skip_reason = 'smoke_cleanup' where id = '${jobId}' and status = 'pending' and type = '${type}'`,
  ], { timeout: 10_000 });

  return true;
}

async function seedSmokeGuestStreak(guestId, streak) {
  if (!process.env.DATABASE_URL) return false;
  if (!isUuid(guestId)) {
    throw new Error(`Refusing to seed streak for invalid guest id: ${guestId}`);
  }

  await execFileAsync("psql", [
    process.env.DATABASE_URL,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `update guests set preferences = jsonb_set(coalesce(preferences, '{}'::jsonb), '{streak}', jsonb_build_object('current', ${streak.current}, 'best', ${streak.best}, 'lastVisitWeek', '${streak.lastVisitWeek}'), true), updated_at = now() where id = '${guestId}'`,
  ], { timeout: 10_000 });

  return true;
}

function markLastRequestHandled(reason) {
  const lastRequest = report.requests.at(-1);
  if (lastRequest && !lastRequest.ok) {
    lastRequest.handled = true;
    lastRequest.handledReason = reason;
  }
}

async function writeReport() {
  report.finishedAt = new Date().toISOString();

  const artifactPath = process.env.OPENSEAT_SMOKE_ARTIFACT_PATH;
  if (!artifactPath) return null;

  const resolvedPath = resolve(process.cwd(), artifactPath);
  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(report, null, 2)}\n`);

  return resolvedPath;
}

async function main() {
  const login = await request("/api/v1/auth/login", {
    method: "POST",
    body: { email: adminEmail, password: adminPassword },
  });
  record("login", { restaurantId: login.restaurant?.id });

  const token = login.token;
  const restaurantId = login.restaurant.id;
  const restaurants = await request("/api/v1/restaurants");
  record("restaurants.list", { count: restaurants.length });

  let availability;
  let slot;
  for (let offset = 10; offset < 40; offset += 1) {
    const candidateDate = plusDays(offset);
    const candidateAvailability = await request(
      `/api/v1/reservations/availability?restaurantId=${restaurantId}&date=${candidateDate}&partySize=2`,
    );
    if (candidateAvailability.slots?.length) {
      reservationDate = candidateDate;
      availability = candidateAvailability;
      slot = candidateAvailability.slots[0];
      break;
    }
  }
  if (!availability?.slots?.length || !slot) throw new Error("No availability slots returned");
  record("reservations.availability", {
    date: reservationDate,
    slotCount: availability.slots.length,
    chosenSlot: slot.time,
  });

  async function createReservationUsingAvailableSlot(body) {
    let lastError;
    for (const candidate of availability.slots) {
      try {
        return await request("/api/v1/reservations", {
          method: "POST",
          body: {
            ...body,
            date: reservationDate,
            timeStart: candidate.time,
            partySize: 2,
          },
        });
      } catch (error) {
        markLastRequestHandled("slot_retry");
        lastError = error;
      }
    }
    throw lastError ?? new Error("Unable to create reservation using available slots");
  }

  const guestPhone = `050${String(Date.now()).slice(-7)}`;
  const guestName = `Smoke Test ${runId}`;
  const created = await createReservationUsingAvailableSlot({
    restaurantId,
    guestName,
    guestPhone,
    notes: runId,
    source: "web",
  });
  const reservation = created.reservation;
  record("reservations.create", {
    reservationId: reservation.id,
    guestId: reservation.guestId,
    status: reservation.status,
  });

  const restaurantDetails = await request(`/api/v1/restaurants/${restaurantId}`);
  const originalDashboardConfig = restaurantDetails.dashboardConfig ?? {};
  const reservationTime = reservation.timeStart ?? slot.time;
  const offPeakWindow = {
    label: `Smoke off-peak ${runId}`,
    start: reservationTime.slice(0, 5),
    end: timePlusMinutes(reservationTime, 30),
    multiplier: 2,
    days: [dayKeyForDate(reservationDate)],
    enabled: true,
  };
  const thankYouQuietHours = {
    enabled: true,
    start: timeInJerusalemPlusMinutes(90),
    end: timeInJerusalemPlusMinutes(210),
  };
  const smokeDashboardConfig = {
    ...originalDashboardConfig,
    loyalty: {
      ...(originalDashboardConfig.loyalty ?? {}),
      offPeakMultipliers: [offPeakWindow],
    },
    engagement: {
      ...(originalDashboardConfig.engagement ?? {}),
      quietHours: thankYouQuietHours,
    },
    gamification: {
      ...(originalDashboardConfig.gamification ?? {}),
      luckySpin: {
        enabled: true,
        triggerEvery: 1,
        prizePool: [
          {
            key: "smoke_bonus",
            labelHe: "בונוס בדיקה",
            labelEn: "Smoke bonus",
            points: 15,
            weight: 1,
            enabled: true,
          },
        ],
      },
    },
  };

  await request(`/api/v1/restaurants/${restaurantId}`, {
    method: "PATCH",
    token,
    body: { dashboardConfig: smokeDashboardConfig },
  });
  cleanupTasks.push(async () => {
    await request(`/api/v1/restaurants/${restaurantId}`, {
      method: "PATCH",
      token,
      body: { dashboardConfig: originalDashboardConfig },
    });
  });
  record("loyalty.off-peak-config", {
    start: offPeakWindow.start,
    end: offPeakWindow.end,
    multiplier: offPeakWindow.multiplier,
    day: offPeakWindow.days[0],
  });
  record("engagement.quiet-hours-config", {
    start: thankYouQuietHours.start,
    end: thankYouQuietHours.end,
  });
  record("gamification.lucky-spin-config", {
    enabled: true,
    triggerEvery: 1,
    prizeCount: 1,
    prizePoints: 15,
  });

  const futureChallengeDate = plusDays(60);
  const futureChallenge = await request("/api/v1/gamification/challenges", {
    method: "POST",
    token,
    body: {
      restaurantId,
      name: `Smoke future challenge ${runId}`,
      description: "Created by the reliability smoke to verify future challenges do not activate early",
      type: "visit_count",
      target: 1,
      reward: 0,
      startDate: futureChallengeDate,
      endDate: futureChallengeDate,
    },
  });
  const futureChallengeId = futureChallenge.challenge?.id;
  if (!futureChallengeId) throw new Error("Future challenge create endpoint did not return challenge.id");

  const activeChallengesAfterFutureCreate = await request(`/api/v1/gamification/challenges?restaurantId=${restaurantId}`, { token });
  const futureChallengeIsActive = (activeChallengesAfterFutureCreate.challenges ?? []).some((item) => item.id === futureChallengeId);
  record("gamification.future-challenge.window", {
    challengeId: futureChallengeId,
    startDate: futureChallengeDate,
    listedAsActive: futureChallengeIsActive,
  });
  if (futureChallengeIsActive) {
    throw new Error(`Future smoke challenge was listed active before start date: ${futureChallengeId}`);
  }

  const deactivatedFutureChallenge = await request(`/api/v1/gamification/challenges/${futureChallengeId}`, {
    method: "PATCH",
    token,
    body: { isActive: false },
  });
  record("gamification.future-challenge.cleanup", {
    challengeId: futureChallengeId,
    isActive: deactivatedFutureChallenge.challenge?.isActive,
  });
  if (deactivatedFutureChallenge.challenge?.isActive !== false) {
    throw new Error(`Future smoke challenge cleanup did not deactivate challenge: ${futureChallengeId}`);
  }

  const expiredChallengeDate = plusDays(-1);
  const expiredChallenge = await request("/api/v1/gamification/challenges", {
    method: "POST",
    token,
    body: {
      restaurantId,
      name: `Smoke expired challenge ${runId}`,
      description: "Created by the reliability smoke to verify expired challenges do not stay active",
      type: "visit_count",
      target: 1,
      reward: 0,
      startDate: expiredChallengeDate,
      endDate: expiredChallengeDate,
    },
  });
  const expiredChallengeId = expiredChallenge.challenge?.id;
  if (!expiredChallengeId) throw new Error("Expired challenge create endpoint did not return challenge.id");

  const activeChallengesAfterExpiredCreate = await request(`/api/v1/gamification/challenges?restaurantId=${restaurantId}`, { token });
  const expiredChallengeIsActive = (activeChallengesAfterExpiredCreate.challenges ?? []).some((item) => item.id === expiredChallengeId);
  record("gamification.expired-challenge.window", {
    challengeId: expiredChallengeId,
    endDate: expiredChallengeDate,
    listedAsActive: expiredChallengeIsActive,
  });
  if (expiredChallengeIsActive) {
    throw new Error(`Expired smoke challenge was listed active after end date: ${expiredChallengeId}`);
  }

  const deactivatedExpiredChallenge = await request(`/api/v1/gamification/challenges/${expiredChallengeId}`, {
    method: "PATCH",
    token,
    body: { isActive: false },
  });
  record("gamification.expired-challenge.cleanup", {
    challengeId: expiredChallengeId,
    isActive: deactivatedExpiredChallenge.challenge?.isActive,
  });
  if (deactivatedExpiredChallenge.challenge?.isActive !== false) {
    throw new Error(`Expired smoke challenge cleanup did not deactivate challenge: ${expiredChallengeId}`);
  }

  const challenge = await request("/api/v1/gamification/challenges", {
    method: "POST",
    token,
    body: {
      restaurantId,
      name: `Smoke visit challenge ${runId}`,
      description: "Created by the reliability smoke to verify automatic visit challenge progress",
      type: "visit_count",
      target: 1,
      reward: 5,
      startDate: visitDate,
      endDate: visitDate,
    },
  });
  const smokeChallengeId = challenge.challenge?.id;
  if (!smokeChallengeId) throw new Error("Challenge create endpoint did not return challenge.id");
  cleanupTasks.push(async () => {
    const cleanedChallenge = await request(`/api/v1/gamification/challenges/${smokeChallengeId}`, {
      method: "PATCH",
      token,
      body: { isActive: false },
    });
    record("gamification.challenge.cleanup-deferred", {
      challengeId: smokeChallengeId,
      isActive: cleanedChallenge.challenge?.isActive,
    });
  });
  record("gamification.challenge.create", {
    challengeId: smokeChallengeId,
    type: challenge.challenge.type,
    target: challenge.challenge.targetValue,
    reward: challenge.challenge.rewardPoints,
  });

  const challengesBeforeCompletion = await request(`/api/v1/gamification/${reservation.guestId}/challenges?restaurantId=${restaurantId}`, { token });
  const smokeChallengeBefore = (challengesBeforeCompletion.challenges ?? []).find((item) => item.challenge?.id === smokeChallengeId);
  record("gamification.challenge.before-completion", {
    challengeId: smokeChallengeId,
    activeChallengeCount: challengesBeforeCompletion.challenges?.length ?? 0,
    hasSmokeChallenge: Boolean(smokeChallengeBefore),
    progress: smokeChallengeBefore?.progress?.currentValue ?? null,
  });
  if (!smokeChallengeBefore) {
    throw new Error(`Created smoke challenge was not returned by guest challenges endpoint: ${smokeChallengeId}`);
  }

  const seededStreak = {
    current: 2,
    best: 2,
    lastVisitWeek: previousIsoWeek(),
  };
  const seededStreakInDb = await seedSmokeGuestStreak(reservation.guestId, seededStreak);
  record("gamification.streak-seed", {
    seeded: seededStreakInDb,
    current: seededStreak.current,
    best: seededStreak.best,
    lastVisitWeek: seededStreak.lastVisitWeek,
  });

  const listed = await request(`/api/v1/reservations?restaurantId=${restaurantId}&date=${reservationDate}`, { token });
  const listedReservation = listed.reservations.find((r) => r.id === reservation.id);
  if (!listedReservation) throw new Error("Created reservation not returned by list endpoint");
  record("reservations.list", { count: listed.reservations.length });

  for (const status of ["confirmed", "seated", "completed"]) {
    const updated = await request(`/api/v1/reservations/${reservation.id}`, {
      method: "PATCH",
      token,
      body: { status },
    });
    record(`reservations.patch.${status}`, { status: updated.reservation.status });
  }

  const loyalty = await request(`/api/v1/loyalty/${reservation.guestId}/balance`, { token });
  record("loyalty.balance", {
    pointsBalance: loyalty.pointsBalance,
    tier: loyalty.tier,
    visits: loyalty.stampCard?.visits,
  });

  const membershipSummaryAfterCompletion = await request(`/api/v1/loyalty/${reservation.guestId}/summary`, { token });
  const streakAfterCompletion = membershipSummaryAfterCompletion.summary?.streak;
  const achievementsAfterCompletion = membershipSummaryAfterCompletion.summary?.achievements;
  const achievementKeysAfterCompletion = (achievementsAfterCompletion?.badges ?? []).map((badge) => badge.key);
  record("gamification.streak-after-completion", {
    current: streakAfterCompletion?.current ?? null,
    best: streakAfterCompletion?.best ?? null,
    lastVisitWeek: streakAfterCompletion?.lastVisitWeek ?? null,
    seeded: seededStreakInDb,
  });
  if (!streakAfterCompletion || streakAfterCompletion.current < 1 || streakAfterCompletion.best < streakAfterCompletion.current) {
    throw new Error(`Reservation completion did not update streak summary: ${JSON.stringify(streakAfterCompletion ?? null)}`);
  }
  if (seededStreakInDb && streakAfterCompletion.current !== 3) {
    throw new Error(`Seeded consecutive streak did not reach milestone 3: ${JSON.stringify(streakAfterCompletion)}`);
  }
  record("gamification.achievements-after-completion", {
    count: achievementsAfterCompletion?.count ?? null,
    badges: achievementKeysAfterCompletion,
  });
  if (!achievementKeysAfterCompletion.includes("first_visit")) {
    throw new Error(`Reservation completion did not unlock first visit achievement: badges=${achievementKeysAfterCompletion.join(",") || "none"}`);
  }

  const loyaltyHistory = await request(`/api/v1/loyalty/${reservation.guestId}/history?limit=20`, { token });
  const visitCompletionTransaction = (loyaltyHistory.transactions ?? []).find((tx) =>
    tx.reservationId === reservation.id && tx.reason === "visit_completion"
  );
  const streakMilestoneTransaction = (loyaltyHistory.transactions ?? []).find((tx) =>
    tx.reservationId === reservation.id && tx.reason === "streak_milestone:3"
  );
  const luckySpinTransaction = (loyaltyHistory.transactions ?? []).find((tx) =>
    tx.reservationId === reservation.id && tx.reason === "lucky_spin:smoke_bonus"
  );
  record("loyalty.off-peak-multiplier", {
    expectedVisitPoints: 20,
    actualVisitPoints: visitCompletionTransaction?.points ?? null,
    reason: visitCompletionTransaction?.reason ?? null,
  });
  if (visitCompletionTransaction?.points !== 20) {
    throw new Error(`Off-peak visit multiplier was not applied: expected 20 visit points, got ${visitCompletionTransaction?.points ?? "missing"}`);
  }
  record("gamification.streak-milestone-bonus", {
    expectedBonusPoints: seededStreakInDb ? 20 : null,
    actualBonusPoints: streakMilestoneTransaction?.points ?? null,
    reason: streakMilestoneTransaction?.reason ?? null,
    reservationId: streakMilestoneTransaction?.reservationId ?? null,
  });
  if (seededStreakInDb && streakMilestoneTransaction?.points !== 20) {
    throw new Error(`Streak milestone bonus was not applied as 2x visit points: expected 20, got ${streakMilestoneTransaction?.points ?? "missing"}`);
  }
  record("gamification.lucky-spin-award", {
    reason: luckySpinTransaction?.reason ?? null,
    points: luckySpinTransaction?.points ?? null,
    reservationId: luckySpinTransaction?.reservationId ?? null,
  });
  if (luckySpinTransaction?.points !== 15) {
    throw new Error(`Lucky spin bonus was not awarded: expected 15, got ${luckySpinTransaction?.points ?? "missing"}`);
  }

  const challengesAfterCompletion = await request(`/api/v1/gamification/${reservation.guestId}/challenges?restaurantId=${restaurantId}`, { token });
  const smokeChallengeAfter = (challengesAfterCompletion.challenges ?? []).find((item) => item.challenge?.id === smokeChallengeId);
  record("gamification.challenge-progress", {
    challengeId: smokeChallengeId,
    activeChallengeCount: challengesAfterCompletion.challenges?.length ?? 0,
    progress: smokeChallengeAfter?.progress?.currentValue ?? null,
    status: smokeChallengeAfter?.progress?.status ?? null,
    completed: Boolean(smokeChallengeAfter?.progress?.completedAt),
    target: smokeChallengeAfter?.challenge?.targetValue ?? null,
  });
  if (!smokeChallengeAfter?.progress) {
    throw new Error(`Reservation completion did not create progress for smoke challenge: ${smokeChallengeId}`);
  }
  if ((smokeChallengeAfter.progress.currentValue ?? 0) < 1 || !smokeChallengeAfter.progress.completedAt) {
    throw new Error(
      `Reservation completion did not complete smoke challenge: ${smokeChallengeId} progress=${smokeChallengeAfter.progress.currentValue ?? "missing"} completedAt=${smokeChallengeAfter.progress.completedAt ?? "missing"}`,
    );
  }

  const repeatedChallengeIncrement = await request(`/api/v1/gamification/${reservation.guestId}/challenges/${smokeChallengeId}/increment`, {
    method: "POST",
    token,
  });
  const loyaltyAfterRepeatedIncrement = await request(`/api/v1/loyalty/${reservation.guestId}/balance`, { token });
  record("gamification.challenge-idempotency", {
    challengeId: smokeChallengeId,
    progress: repeatedChallengeIncrement.progress,
    target: repeatedChallengeIncrement.target,
    completed: repeatedChallengeIncrement.completed,
    pointsBefore: loyalty.pointsBalance,
    pointsAfter: loyaltyAfterRepeatedIncrement.pointsBalance,
  });
  if (repeatedChallengeIncrement.progress !== smokeChallengeAfter.progress.currentValue) {
    throw new Error(`Completed challenge increment changed progress: before=${smokeChallengeAfter.progress.currentValue} after=${repeatedChallengeIncrement.progress}`);
  }
  if (loyaltyAfterRepeatedIncrement.pointsBalance !== loyalty.pointsBalance) {
    throw new Error(`Completed challenge increment awarded duplicate points: before=${loyalty.pointsBalance} after=${loyaltyAfterRepeatedIncrement.pointsBalance}`);
  }

  const leaderboardOptIn = await request(`/api/v1/gamification/${reservation.guestId}/leaderboard/opt-in`, {
    method: "POST",
    token,
  });
  record("gamification.leaderboard.opt-in", {
    optedIn: leaderboardOptIn.leaderboard?.optedIn ?? null,
    rank: leaderboardOptIn.rank?.rank ?? null,
    pointsEarned: leaderboardOptIn.rank?.pointsEarned ?? null,
  });
  if (leaderboardOptIn.leaderboard?.optedIn !== true || !leaderboardOptIn.rank) {
    throw new Error(`Leaderboard opt-in did not return a ranked guest: ${JSON.stringify(leaderboardOptIn)}`);
  }

  const leaderboard = await request(`/api/v1/gamification/leaderboard?restaurantId=${restaurantId}&limit=5`, { token });
  const leaderboardEntry = (leaderboard.leaderboard?.entries ?? []).find((entry) => entry.guestId === reservation.guestId);
  record("gamification.leaderboard.rank", {
    participantCount: leaderboard.leaderboard?.participantCount ?? null,
    rank: leaderboardEntry?.rank ?? null,
    pointsEarned: leaderboardEntry?.pointsEarned ?? null,
  });
  if (!leaderboardEntry || leaderboardEntry.pointsEarned < 1) {
    throw new Error(`Leaderboard did not include opted-in smoke guest: ${JSON.stringify(leaderboard.leaderboard ?? null)}`);
  }

  const finalizedLeaderboard = await request("/api/v1/gamification/leaderboard/finalize", {
    method: "POST",
    token,
    body: {
      restaurantId,
      rewards: [30],
    },
  });
  const leaderboardWinner = (finalizedLeaderboard.result?.winners ?? []).find((winner) => winner.guestId === reservation.guestId);
  record("gamification.leaderboard.finalize", {
    winnerCount: finalizedLeaderboard.result?.winners?.length ?? 0,
    rank: leaderboardWinner?.rank ?? null,
    rewardPoints: leaderboardWinner?.rewardPoints ?? null,
    summaryJobId: leaderboardWinner?.summaryJobId ?? null,
  });
  if (!leaderboardWinner || leaderboardWinner.rewardPoints !== 30 || !leaderboardWinner.summaryJobId) {
    throw new Error(`Leaderboard finalization did not reward/schedule smoke guest: ${JSON.stringify(finalizedLeaderboard.result ?? null)}`);
  }

  const shareTemplateResult = await request(
    `/api/v1/gamification/${reservation.guestId}/share-templates?achievementKey=first_visit`,
    { token },
  );
  const shareTemplates = shareTemplateResult.shareTemplates?.templates ?? [];
  const shareMoments = shareTemplates.map((template) => template.moment);
  const firstVisitShareTemplate = shareTemplates.find((template) => template.key === "achievement:first_visit");
  record("gamification.share-templates", {
    count: shareTemplates.length,
    moments: shareMoments,
    hasFirstVisit: Boolean(firstVisitShareTemplate),
    hasStreak: shareMoments.includes("streak_milestone"),
    hasLeaderboard: shareMoments.includes("leaderboard_rank"),
    storyFormat: firstVisitShareTemplate?.image?.format ?? null,
    accentColor: firstVisitShareTemplate?.image?.accentColor ?? null,
  });
  if (!firstVisitShareTemplate || firstVisitShareTemplate.image?.format !== "story" || !firstVisitShareTemplate.shareText?.en) {
    throw new Error(`Share templates did not include a first-visit story template: ${JSON.stringify(shareTemplateResult.shareTemplates ?? null)}`);
  }
  if (!shareMoments.includes("streak_milestone") || !shareMoments.includes("leaderboard_rank")) {
    throw new Error(`Share templates did not include expected streak and leaderboard moments: ${shareMoments.join(",") || "none"}`);
  }

  cleanupTasks.push(async () => {
    const cleaned = await markSmokeEngagementJobSent(leaderboardWinner.summaryJobId, "leaderboard_summary");
    record("gamification.leaderboard.cleanup", {
      jobId: leaderboardWinner.summaryJobId,
      markedSent: cleaned,
    });
    const optedOut = await request(`/api/v1/gamification/${reservation.guestId}/leaderboard/opt-out`, {
      method: "POST",
      token,
    });
    record("gamification.leaderboard.opt-out", {
      optedIn: optedOut.leaderboard?.optedIn ?? null,
    });
  });

  const deactivatedChallenge = await request(`/api/v1/gamification/challenges/${smokeChallengeId}`, {
    method: "PATCH",
    token,
    body: { isActive: false },
  });
  record("gamification.challenge.cleanup", {
    challengeId: smokeChallengeId,
    isActive: deactivatedChallenge.challenge?.isActive,
  });
  if (deactivatedChallenge.challenge?.isActive !== false) {
    throw new Error(`Smoke challenge cleanup did not deactivate challenge: ${smokeChallengeId}`);
  }

  const brokenStreakReservationResult = await createReservationUsingAvailableSlot({
    restaurantId,
    guestName: `Smoke Broken Streak ${runId}`,
    guestPhone: `051${String(Date.now()).slice(-7)}`,
    notes: `${runId} broken-streak`,
    source: "web",
  });
  const brokenStreakReservation = brokenStreakReservationResult.reservation;
  const brokenStreakSeed = {
    current: 3,
    best: 3,
    lastVisitWeek: isoWeekWeeksAgo(3),
  };
  const seededBrokenStreakInDb = await seedSmokeGuestStreak(brokenStreakReservation.guestId, brokenStreakSeed);
  record("gamification.streak-broken-seed", {
    guestId: brokenStreakReservation.guestId,
    seeded: seededBrokenStreakInDb,
    current: brokenStreakSeed.current,
    best: brokenStreakSeed.best,
    lastVisitWeek: brokenStreakSeed.lastVisitWeek,
  });

  for (const status of ["confirmed", "seated", "completed"]) {
    await request(`/api/v1/reservations/${brokenStreakReservation.id}`, {
      method: "PATCH",
      token,
      body: { status },
    });
  }

  const brokenStreakSummary = await request(`/api/v1/loyalty/${brokenStreakReservation.guestId}/summary`, { token });
  const brokenStreakAfter = brokenStreakSummary.summary?.streak;
  const brokenStreakJobs = await request(`/api/v1/engagement/jobs?restaurantId=${restaurantId}&guestId=${brokenStreakReservation.guestId}`, { token });
  const streakBrokenJob = (brokenStreakJobs.jobs ?? []).find((job) => job.type === "streak_broken");
  const brokenLuckySpinJob = (brokenStreakJobs.jobs ?? []).find((job) => job.type === "lucky_spin_reward");
  const brokenThankYouJob = (brokenStreakJobs.jobs ?? []).find((job) => job.type === "thank_you");
  record("gamification.streak-broken-recovery", {
    current: brokenStreakAfter?.current ?? null,
    best: brokenStreakAfter?.best ?? null,
    previousCurrent: brokenStreakSeed.current,
    jobStatus: streakBrokenJob?.status ?? null,
    jobId: streakBrokenJob?.id ?? null,
  });
  if (!brokenStreakAfter || brokenStreakAfter.current !== 1 || brokenStreakAfter.best < brokenStreakSeed.best) {
    throw new Error(`Broken streak did not reset to one while preserving best: ${JSON.stringify(brokenStreakAfter ?? null)}`);
  }
  if (!streakBrokenJob || streakBrokenJob.status !== "pending") {
    throw new Error(`Broken streak did not schedule a recovery job: ${JSON.stringify(brokenStreakJobs.jobs ?? [])}`);
  }
  cleanupTasks.push(async () => {
    const cleaned = await markSmokeEngagementJobSent(streakBrokenJob.id, "streak_broken");
    record("gamification.streak-broken.cleanup", {
      jobId: streakBrokenJob.id,
      markedSent: cleaned,
    });
  });
  if (brokenLuckySpinJob) {
    cleanupTasks.push(async () => {
      const cleaned = await markSmokeEngagementJobSent(brokenLuckySpinJob.id, "lucky_spin_reward");
      record("gamification.streak-broken-lucky-spin.cleanup", {
        jobId: brokenLuckySpinJob.id,
        markedSent: cleaned,
      });
    });
  }
  if (brokenThankYouJob) {
    cleanupTasks.push(async () => {
      const cleaned = await markSmokeEngagementJobSent(brokenThankYouJob.id, "thank_you");
      record("gamification.streak-broken-thank-you.cleanup", {
        jobId: brokenThankYouJob.id,
        markedSent: cleaned,
      });
    });
  }

  const membershipFailures = await request(`/api/v1/loyalty/processing-failures?restaurantId=${restaurantId}&status=open&limit=20`, { token });
  const relatedMembershipFailures = (membershipFailures.failures ?? []).filter((failure) =>
    failure.guestId === reservation.guestId || failure.reservationId === reservation.id,
  );
  record("membership.processing-failures", {
    openCount: membershipFailures.failures?.length ?? 0,
    relatedOpenCount: relatedMembershipFailures.length,
    relatedStages: relatedMembershipFailures.map((failure) => failure.stage),
  });
  if (relatedMembershipFailures.length > 0) {
    throw new Error(`Reservation completion left open membership processing failures: ${relatedMembershipFailures.map((failure) => `${failure.stage}:${failure.id}`).join(", ")}`);
  }

  const engagementJobs = await request(`/api/v1/engagement/jobs?restaurantId=${restaurantId}&guestId=${reservation.guestId}`, { token });
  const thankYouJob = (engagementJobs.jobs ?? []).find((job) => job.type === "thank_you");
  const luckySpinJob = (engagementJobs.jobs ?? []).find((job) => job.type === "lucky_spin_reward");
  const challengeCompletionJob = (engagementJobs.jobs ?? []).find((job) => job.type === "challenge_completion");
  const thankYouTriggerTime = thankYouJob?.triggerAt ? timeInJerusalem(thankYouJob.triggerAt) : null;
  const thankYouOutsideQuietHours = thankYouTriggerTime
    ? !isTimeInWindow(thankYouTriggerTime, thankYouQuietHours.start, thankYouQuietHours.end)
    : false;
  record("engagement.jobs", {
    jobCount: engagementJobs.jobs?.length ?? 0,
    statuses: [...new Set((engagementJobs.jobs ?? []).map((job) => job.status))],
    types: [...new Set((engagementJobs.jobs ?? []).map((job) => job.type))],
    challengeCompletionJobId: challengeCompletionJob?.id ?? null,
    challengeCompletionStatus: challengeCompletionJob?.status ?? null,
    thankYouTriggerAt: thankYouJob?.triggerAt ?? null,
    thankYouTriggerTime,
    thankYouQuietStart: thankYouQuietHours.start,
    thankYouQuietEnd: thankYouQuietHours.end,
    thankYouOutsideQuietHours,
  });
  if (!luckySpinJob || luckySpinJob.status !== "pending") {
    throw new Error(`Lucky spin reward delivery job was not scheduled: ${JSON.stringify(engagementJobs.jobs ?? [])}`);
  }
  if (!challengeCompletionJob || challengeCompletionJob.status !== "pending") {
    throw new Error(`Challenge completion congratulations job was not scheduled: ${JSON.stringify(engagementJobs.jobs ?? [])}`);
  }
  if (!thankYouJob) {
    throw new Error("Reservation completion did not schedule a thank-you engagement job");
  }
  if (!thankYouOutsideQuietHours) {
    throw new Error(`Thank-you job was scheduled inside quiet hours: trigger=${thankYouTriggerTime} quiet=${thankYouQuietHours.start}-${thankYouQuietHours.end}`);
  }
  cleanupTasks.push(async () => {
    const cleaned = await markSmokeEngagementJobSent(thankYouJob.id);
    record("engagement.thank-you.cleanup", {
      jobId: thankYouJob.id,
      markedSent: cleaned,
    });
  });
  cleanupTasks.push(async () => {
    const cleaned = await markSmokeEngagementJobSent(luckySpinJob.id, "lucky_spin_reward");
    record("gamification.lucky-spin.cleanup", {
      jobId: luckySpinJob.id,
      markedSent: cleaned,
    });
  });
  cleanupTasks.push(async () => {
    const cleaned = await markSmokeEngagementJobSent(challengeCompletionJob.id, "challenge_completion");
    record("gamification.challenge-completion.cleanup", {
      jobId: challengeCompletionJob.id,
      markedSent: cleaned,
    });
  });

  const positiveFeedback = await request("/api/v1/feedback", {
    method: "POST",
    body: {
      restaurantId,
      guestId: reservation.guestId,
      reservationId: reservation.id,
      rating: 5,
      feedback: `Loved it ${runId}`,
      channel: "web",
    },
  });
  const positiveReviewJobId = positiveFeedback.reviewRouting?.engagementJobId;
  record("engagement.review-routing-positive", {
    route: positiveFeedback.reviewRouting?.route ?? null,
    sentiment: positiveFeedback.reviewRouting?.sentiment ?? null,
    reviewUrlPresent: Boolean(positiveFeedback.reviewRouting?.reviewUrl),
    jobId: positiveReviewJobId ?? null,
    jobStatus: positiveFeedback.reviewRouting?.engagementJobStatus ?? null,
    delayHours: positiveFeedback.reviewRouting?.delayHours ?? null,
  });
  if (positiveFeedback.reviewRouting?.route !== "public_review" || !positiveFeedback.reviewRouting?.reviewUrl || !positiveReviewJobId || positiveFeedback.reviewRouting?.engagementJobStatus !== "pending") {
    throw new Error(`Positive feedback did not route to a pending public review request: ${JSON.stringify(positiveFeedback.reviewRouting ?? {})}`);
  }
  cleanupTasks.push(async () => {
    const cleaned = await markSmokeEngagementJobSent(positiveReviewJobId, "review_request");
    record("engagement.review-request.cleanup", {
      jobId: positiveReviewJobId,
      markedSent: cleaned,
    });
  });

  const negativeGuest = await request("/api/v1/guests", {
    method: "POST",
    token,
    body: {
      restaurantId,
      name: `Smoke Negative Feedback ${runId}`,
      phone: `052${String(Date.now()).slice(-7)}`,
      language: "he",
      source: "web",
    },
  });
  const negativeGuestId = negativeGuest.guest?.id;
  if (!negativeGuestId) throw new Error("Negative feedback smoke guest create endpoint did not return guest.id");
  const negativeFeedback = await request("/api/v1/feedback", {
    method: "POST",
    body: {
      restaurantId,
      guestId: negativeGuestId,
      rating: 1,
      feedback: `Service recovery smoke ${runId}`,
      channel: "web",
    },
  });
  const negativeGuestJobs = await request(`/api/v1/engagement/jobs?restaurantId=${restaurantId}&guestId=${negativeGuestId}`, { token });
  const hasNegativeReviewRequest = (negativeGuestJobs.jobs ?? []).some((job) => job.type === "review_request" && job.status === "pending");
  record("engagement.review-routing-negative", {
    route: negativeFeedback.reviewRouting?.route ?? null,
    sentiment: negativeFeedback.reviewRouting?.sentiment ?? null,
    ownerContactPresent: Boolean(negativeFeedback.reviewRouting?.ownerContact),
    skippedReviewRequests: negativeFeedback.reviewRouting?.skippedReviewRequests ?? null,
    recoveryActions: negativeFeedback.reviewRouting?.recoveryActions ?? [],
    pendingReviewRequest: hasNegativeReviewRequest,
  });
  if (negativeFeedback.reviewRouting?.route !== "private_recovery" || hasNegativeReviewRequest) {
    throw new Error(`Negative feedback was not routed privately: routing=${JSON.stringify(negativeFeedback.reviewRouting ?? {})} pendingReviewRequest=${hasNegativeReviewRequest}`);
  }

  const birthdayGuest = await request("/api/v1/guests", {
    method: "POST",
    token,
    body: {
      restaurantId,
      name: `Smoke Birthday ${runId}`,
      phone: `053${String(Date.now()).slice(-7)}`,
      language: "he",
      source: "web",
    },
  });
  const birthdayGuestId = birthdayGuest.guest?.id;
  if (!birthdayGuestId) throw new Error("Birthday smoke guest create endpoint did not return guest.id");

  await request(`/api/v1/guests/${birthdayGuestId}`, {
    method: "PATCH",
    token,
    body: { preferences: { birthday: jerusalemMonthDay() } },
  });
  const birthdayCheck = await request(`/api/v1/engagement/birthdays/check?restaurantId=${restaurantId}`, {
    method: "POST",
    token,
  });
  const birthdayJobs = await request(`/api/v1/engagement/jobs?restaurantId=${restaurantId}&guestId=${birthdayGuestId}`, { token });
  const birthdayJob = (birthdayJobs.jobs ?? []).find((job) => job.type === "birthday");
  record("engagement.birthday-check", {
    guestId: birthdayGuestId,
    due: birthdayCheck.result?.due ?? null,
    scheduled: birthdayCheck.result?.scheduled ?? null,
    skippedExisting: birthdayCheck.result?.skippedExisting ?? null,
    skippedPolicy: birthdayCheck.result?.skippedPolicy ?? null,
    jobStatus: birthdayJob?.status ?? null,
  });
  if (!birthdayJob || !["pending", "sent", "skipped"].includes(birthdayJob.status)) {
    throw new Error(`Birthday check did not create a birthday engagement job: ${JSON.stringify(birthdayCheck.result ?? {})}`);
  }

  const birthdayChallengeGuest = await request("/api/v1/guests", {
    method: "POST",
    token,
    body: {
      restaurantId,
      name: `Smoke Birthday Challenge ${runId}`,
      phone: `055${String(Date.now()).slice(-7)}`,
      language: "he",
      source: "web",
    },
  });
  const birthdayChallengeGuestId = birthdayChallengeGuest.guest?.id;
  if (!birthdayChallengeGuestId) throw new Error("Birthday-week smoke guest create endpoint did not return guest.id");
  await request(`/api/v1/guests/${birthdayChallengeGuestId}`, {
    method: "PATCH",
    token,
    body: { preferences: { birthday: jerusalemMonthDayPlusDays(7) } },
  });
  const birthdayWeekCheck = await request(`/api/v1/gamification/birthday-week/check?restaurantId=${restaurantId}`, {
    method: "POST",
    token,
  });
  const birthdayWeekChallenges = await request(`/api/v1/gamification/${birthdayChallengeGuestId}/challenges?restaurantId=${restaurantId}`, { token });
  const birthdayWeekChallenge = (birthdayWeekChallenges.challenges ?? []).find((item) =>
    item.challenge?.type === "birthday_week" && item.challenge?.metadata?.guestId === birthdayChallengeGuestId
  );
  if (!birthdayWeekChallenge?.challenge?.id) {
    throw new Error(`Birthday-week check did not create a targeted challenge: ${JSON.stringify(birthdayWeekCheck.result ?? {})}`);
  }
  const unrelatedGuestChallenges = await request(`/api/v1/gamification/${reservation.guestId}/challenges?restaurantId=${restaurantId}`, { token });
  const leakedBirthdayWeekChallenge = (unrelatedGuestChallenges.challenges ?? []).some((item) => item.challenge?.id === birthdayWeekChallenge.challenge.id);
  const birthdayWeekBalanceBefore = await request(`/api/v1/loyalty/${birthdayChallengeGuestId}/balance`, { token });
  const birthdayWeekIncrement = await request(`/api/v1/gamification/${birthdayChallengeGuestId}/challenges/${birthdayWeekChallenge.challenge.id}/increment`, {
    method: "POST",
    token,
  });
  const birthdayWeekBalanceAfter = await request(`/api/v1/loyalty/${birthdayChallengeGuestId}/balance`, { token });
  record("gamification.birthday-week-challenge", {
    guestId: birthdayChallengeGuestId,
    challengeId: birthdayWeekChallenge.challenge.id,
    due: birthdayWeekCheck.result?.due ?? null,
    created: birthdayWeekCheck.result?.created ?? null,
    skippedExisting: birthdayWeekCheck.result?.skippedExisting ?? null,
    target: birthdayWeekChallenge.challenge.targetValue,
    reward: birthdayWeekChallenge.challenge.rewardPoints,
    progress: birthdayWeekIncrement.progress,
    completed: birthdayWeekIncrement.completed,
    leakedToOtherGuest: leakedBirthdayWeekChallenge,
    pointsBefore: birthdayWeekBalanceBefore.pointsBalance,
    pointsAfter: birthdayWeekBalanceAfter.pointsBalance,
  });
  if (leakedBirthdayWeekChallenge) {
    throw new Error(`Birthday-week challenge leaked to unrelated guest: ${birthdayWeekChallenge.challenge.id}`);
  }
  if (!birthdayWeekIncrement.completed || birthdayWeekBalanceAfter.pointsBalance - birthdayWeekBalanceBefore.pointsBalance !== birthdayWeekChallenge.challenge.rewardPoints) {
    throw new Error(`Birthday-week challenge did not award expected points: before=${birthdayWeekBalanceBefore.pointsBalance} after=${birthdayWeekBalanceAfter.pointsBalance} reward=${birthdayWeekChallenge.challenge.rewardPoints}`);
  }
  const activeBirthdayWeekChallenges = await request(`/api/v1/gamification/challenges?restaurantId=${restaurantId}`, { token });
  const smokeBirthdayWeekChallenges = (activeBirthdayWeekChallenges.challenges ?? []).filter((item) =>
    item.type === "birthday_week"
    && typeof item.name === "string"
    && item.name.startsWith("Birthday week challenge: Smoke ")
  );
  let targetBirthdayWeekChallengeActive = true;
  for (const item of smokeBirthdayWeekChallenges) {
    const deactivated = await request(`/api/v1/gamification/challenges/${item.id}`, {
      method: "PATCH",
      token,
      body: { isActive: false },
    });
    if (item.id === birthdayWeekChallenge.challenge.id) {
      targetBirthdayWeekChallengeActive = deactivated.challenge?.isActive !== false;
    }
  }
  record("gamification.birthday-week.cleanup", {
    challengeId: birthdayWeekChallenge.challenge.id,
    cleanedCount: smokeBirthdayWeekChallenges.length,
    isActive: targetBirthdayWeekChallengeActive,
  });
  if (targetBirthdayWeekChallengeActive) {
    throw new Error(`Birthday-week smoke challenge cleanup did not deactivate challenge: ${birthdayWeekChallenge.challenge.id}`);
  }

  const anniversaryGuest = await request("/api/v1/guests", {
    method: "POST",
    token,
    body: {
      restaurantId,
      name: `Smoke Anniversary ${runId}`,
      phone: `054${String(Date.now()).slice(-7)}`,
      language: "he",
      source: "web",
    },
  });
  const anniversaryGuestId = anniversaryGuest.guest?.id;
  if (!anniversaryGuestId) throw new Error("Anniversary smoke guest create endpoint did not return guest.id");

  const firstVisitDate = lastYearJerusalemDate();
  await request("/api/v1/visits", {
    method: "POST",
    token,
    body: {
      guestId: anniversaryGuestId,
      restaurantId,
      date: firstVisitDate,
      partySize: 2,
      items: [{ name: "Smoke anniversary meal", category: "main", price: 80, rating: 5 }],
      totalSpend: 80,
      channel: "web",
    },
  });
  const anniversaryCheck = await request(`/api/v1/engagement/anniversaries/check?restaurantId=${restaurantId}`, {
    method: "POST",
    token,
  });
  const anniversaryJobs = await request(`/api/v1/engagement/jobs?restaurantId=${restaurantId}&guestId=${anniversaryGuestId}`, { token });
  const anniversaryJob = (anniversaryJobs.jobs ?? []).find((job) => job.type === "anniversary");
  record("engagement.anniversary-check", {
    guestId: anniversaryGuestId,
    firstVisitDate,
    due: anniversaryCheck.result?.due ?? null,
    scheduled: anniversaryCheck.result?.scheduled ?? null,
    skippedExisting: anniversaryCheck.result?.skippedExisting ?? null,
    skippedPolicy: anniversaryCheck.result?.skippedPolicy ?? null,
    jobStatus: anniversaryJob?.status ?? null,
  });
  if (!anniversaryJob || !["pending", "sent", "skipped"].includes(anniversaryJob.status)) {
    throw new Error(`Anniversary check did not create an anniversary engagement job: ${JSON.stringify(anniversaryCheck.result ?? {})}`);
  }

  const winBackGuest = await request("/api/v1/guests", {
    method: "POST",
    token,
    body: {
      restaurantId,
      name: `Smoke WinBack ${runId}`,
      phone: `052${String(Date.now()).slice(-7)}`,
      language: "he",
      source: "web",
    },
  });
  const winBackGuestId = winBackGuest.guest?.id;
  if (!winBackGuestId) throw new Error("Win-back smoke guest create endpoint did not return guest.id");

  const winBackVisitDate = plusDays(-31);
  await request("/api/v1/visits", {
    method: "POST",
    token,
    body: {
      guestId: winBackGuestId,
      restaurantId,
      date: winBackVisitDate,
      partySize: 2,
      items: [{ name: "Smoke comeback meal", category: "main", price: 80, rating: 5 }],
      totalSpend: 80,
      channel: "web",
    },
  });
  const winBackCheck = await request(`/api/v1/engagement/win-back/check?restaurantId=${restaurantId}`, {
    method: "POST",
    token,
  });
  const winBackJobs = await request(`/api/v1/engagement/jobs?restaurantId=${restaurantId}&guestId=${winBackGuestId}`, { token });
  const winBackJob = (winBackJobs.jobs ?? []).find((job) => job.type === "win_back_30");
  record("engagement.win-back-overdue", {
    guestId: winBackGuestId,
    lastVisitDate: winBackVisitDate,
    scheduled30: winBackCheck.result?.scheduled30 ?? null,
    skippedExisting: winBackCheck.result?.skippedExisting ?? null,
    skippedPolicy: winBackCheck.result?.skippedPolicy ?? null,
    jobStatus: winBackJob?.status ?? null,
  });
  if (!winBackJob || winBackJob.status !== "pending") {
    throw new Error(`Overdue win-back check did not schedule win_back_30: ${JSON.stringify(winBackCheck.result ?? {})}`);
  }

  const tableStatus = await request(`/api/v1/restaurants/${restaurantId}/table-status`, { token });
  record("restaurants.table-status", { tableCount: tableStatus.length });

  const fullProfileBeforeVisit = await request(`/api/v1/guests/${reservation.guestId}/full-profile`, { token });
  record("guests.full-profile.before-visit", {
    tagCount: fullProfileBeforeVisit.profile?.guest?.tags?.length ?? 0,
    visitHistoryCount: fullProfileBeforeVisit.profile?.visitHistory?.length ?? 0,
    challengeCount: fullProfileBeforeVisit.profile?.challenges?.length ?? 0,
  });

  const visit = await request("/api/v1/visits", {
    method: "POST",
    token,
    body: {
      guestId: reservation.guestId,
      restaurantId,
      reservationId: reservation.id,
      date: visitDate,
      partySize: 2,
      items: [
        { name: "Smoke tasting menu", category: "tasting_menu", price: 72, rating: 5 },
        { name: "Fries", category: "side", price: 24, rating: 4 },
      ],
      totalSpend: 96,
      feedback: `Automated reliability smoke ${runId}`,
      rating: 5,
      occasion: "smoke-test",
      dietaryNotes: { kosher: "mehadrin" },
      staffNotes: runId,
      channel: "web",
    },
  });
  record("visits.create", { visitId: visit.visit.id });

  const membershipSummaryAfterVisit = await request(`/api/v1/loyalty/${reservation.guestId}/summary`, { token });
  const menuExploration = membershipSummaryAfterVisit.summary?.menuExploration;
  const badgeKeys = (menuExploration?.badges ?? []).map((badge) => badge.key);
  const achievementsAfterVisit = membershipSummaryAfterVisit.summary?.achievements;
  const achievementKeysAfterVisit = (achievementsAfterVisit?.badges ?? []).map((badge) => badge.key);
  record("gamification.menu-exploration", {
    categoryCount: menuExploration?.categoryCount ?? null,
    badges: badgeKeys,
  });
  if (!badgeKeys.includes("menu_explorer")) {
    throw new Error(`Visit items did not unlock menu exploration badge: badges=${badgeKeys.join(",") || "none"}`);
  }
  record("gamification.achievements-after-visit", {
    count: achievementsAfterVisit?.count ?? null,
    badges: achievementKeysAfterVisit,
  });
  if (!achievementKeysAfterVisit.includes("tasting_menu")) {
    throw new Error(`Tasting-menu visit did not unlock tasting menu achievement: badges=${achievementKeysAfterVisit.join(",") || "none"}`);
  }

  const insights = await request(`/api/v1/visits/${reservation.guestId}/insights`, { token });
  record("visits.insights", {
    favoriteItems: insights.insights?.favoriteItems?.length ?? 0,
    visitFrequency: insights.insights?.visitFrequency ?? null,
  });

  const fullProfileAfterVisit = await request(`/api/v1/guests/${reservation.guestId}/full-profile`, { token });
  record("guests.full-profile.after-visit", {
    visitHistoryCount: fullProfileAfterVisit.profile?.visitHistory?.length ?? 0,
    dietaryProfileCount: fullProfileAfterVisit.profile?.dietaryProfile?.length ?? 0,
  });

  report.status = "passed";
}

let failure;

try {
  await main();
} catch (error) {
  failure = error;
  report.status = "failed";
  report.error = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };
} finally {
  for (const cleanup of cleanupTasks.reverse()) {
    try {
      await cleanup();
    } catch (error) {
      report.cleanupErrors = [
        ...(report.cleanupErrors ?? []),
        error instanceof Error ? error.message : String(error),
      ];
    }
  }
  const artifactPath = await writeReport();
  if (artifactPath) {
    console.error(`Smoke artifact: ${artifactPath}`);
  }
}

console.log(JSON.stringify(report, null, 2));

if (failure) {
  throw failure;
}
