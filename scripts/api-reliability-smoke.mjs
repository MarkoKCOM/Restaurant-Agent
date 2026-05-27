#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

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

function record(step, details) {
  report.steps.push({ step, ...details });
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
  record("engagement.jobs", {
    jobCount: engagementJobs.jobs?.length ?? 0,
    statuses: [...new Set((engagementJobs.jobs ?? []).map((job) => job.status))],
    types: [...new Set((engagementJobs.jobs ?? []).map((job) => job.type))],
  });

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
        { name: "Burger", category: "main", price: 72, rating: 5 },
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
  const artifactPath = await writeReport();
  if (artifactPath) {
    console.error(`Smoke artifact: ${artifactPath}`);
  }
}

console.log(JSON.stringify(report, null, 2));

if (failure) {
  throw failure;
}
