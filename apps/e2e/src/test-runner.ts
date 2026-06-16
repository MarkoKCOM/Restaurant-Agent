/**
 * OpenSeat E2E Test Runner
 *
 * Exercises the full API flow and posts results to a Telegram topic.
 * Can run standalone (CLI) or triggered by the bot via /test command.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as api from "./api-client.js";

// BFF Raanana restaurant ID (seeded). Overridable for ephemeral CI databases
// where the seed assigns a fresh UUID.
const RESTAURANT_ID =
  process.env.OPENSEAT_E2E_RESTAURANT_ID || "c3c22e37-a309-4fde-aa6c-6e714212a3bc";
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultArtifactDir = resolve(packageRoot, "artifacts");
const apiUrl = process.env.OPENSEAT_API_URL || "http://localhost:3001";

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
  durationMs: number;
}

interface TestRunReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  apiUrl: string;
  total: number;
  passed: number;
  failed: number;
  totalMs: number;
  environment: {
    cwd: string;
    nodeVersion: string;
    pid: number;
  };
  results: TestResult[];
  summary: string;
}

function plusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function runTest(name: string, fn: () => Promise<string>): Promise<TestResult> {
  const start = Date.now();
  try {
    const detail = await fn();
    return { name, pass: true, detail, durationMs: Date.now() - start };
  } catch (err) {
    return { name, pass: false, detail: String(err), durationMs: Date.now() - start };
  }
}

async function writeRunArtifact(report: TestRunReport): Promise<string> {
  const artifactPath = process.env.OPENSEAT_E2E_ARTIFACT_PATH
    ? resolve(process.cwd(), process.env.OPENSEAT_E2E_ARTIFACT_PATH)
    : resolve(defaultArtifactDir, `${report.runId}.json`);

  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`);

  return artifactPath;
}

export async function runAllTests(): Promise<TestRunReport> {
  const runId = `e2e-${Date.now()}`;
  const startedAt = new Date();
  const results: TestResult[] = [];
  let reservationId = "";
  let guestId = "";
  let rewardId = "";
  let rewardClaimId = "";
  let rewardClaimCode = "";
  let rewardTemplateKey = "referral-dessert";
  let rewardRecommendedMoments = ["referral"];
  let rewardPitchHe = `תביא חבר חדש ונפנק אתכם בקינוח. ${runId}`;
  let rewardPitchEn = `Bring a new friend and we will cover dessert. ${runId}`;
  let noShowReservationId = "";
  let noShowGuestId = "";
  let patchNoShowReservationId = "";
  let patchNoShowGuestId = "";
  let availabilitySlots: string[] = [];
  const guestPhone = `050${String(Date.now()).slice(-7)}`;
  let reservationDate = plusDays(10);
  const today = plusDays(0);

  function requireSlot(index = 0): string {
    const slot = availabilitySlots[index] ?? availabilitySlots[availabilitySlots.length - 1];
    if (!slot) throw new Error("No availability slot cached");
    return slot;
  }

  async function createReservationUsingAvailableSlot(input: {
    guestName: string;
    guestPhone: string;
    notes: string;
    source: string;
    partySize?: number;
  }) {
    let lastError: unknown = null;
    const candidateSlots = availabilitySlots.length > 0 ? availabilitySlots : [requireSlot(0)];
    for (const timeStart of candidateSlots) {
      try {
        return await api.createReservation({
          restaurantId: RESTAURANT_ID,
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          date: reservationDate,
          timeStart,
          partySize: input.partySize ?? 2,
          notes: input.notes,
          source: input.source,
        });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("Unable to create reservation using available slots");
  }

  // 1. Health check
  results.push(await runTest("Health Check", async () => {
    await api.healthCheck();
    return "API is up";
  }));

  results.push(await runTest("Admin Diagnostics", async () => {
    const data = await api.getAdminDiagnostics();
    const deployment = (data as any).deployment;
    const migrationDrift = deployment?.migrationDrift;
    const source = deployment?.source;
    const membershipProcessing = (data as any).operational?.membershipProcessing;
    const gamification = (data as any).operational?.gamification;
    const engagement = (data as any).operational?.engagement;
    if (!deployment || !migrationDrift) {
      throw new Error("Diagnostics response missing deployment migration state");
    }
    if (source?.status !== "ok" || typeof source.shortCommit !== "string") {
      throw new Error("Diagnostics response missing deployment source revision");
    }
    if (source.checkout?.status !== "ok" || typeof source.checkout.shortCommit !== "string") {
      throw new Error("Diagnostics response missing deployment checkout revision");
    }
    if (source.checkoutMatchesBuild !== true) {
      throw new Error(`Diagnostics build/checkout mismatch: build=${source.shortCommit} checkout=${source.checkout.shortCommit}`);
    }
    if (migrationDrift.status !== "ok") {
      throw new Error(`Migration drift status is ${migrationDrift.status}`);
    }
    if (
      !membershipProcessing
      || !["ok", "attention"].includes(membershipProcessing.status)
      || typeof membershipProcessing.openCount !== "number"
    ) {
      throw new Error("Diagnostics response missing membership processing summary");
    }
    if (
      !gamification
      || !["ok", "attention"].includes(gamification.status)
      || typeof gamification.challenges?.active !== "number"
      || typeof gamification.challenges?.stuckCompletions !== "number"
      || typeof gamification.referrals?.guestsWithReferralCode !== "number"
      || typeof gamification.referrals?.referrerCreditMismatches !== "number"
    ) {
      throw new Error("Diagnostics response missing gamification summary");
    }
    if (
      !engagement
      || !["ok", "attention"].includes(engagement.status)
      || typeof engagement.totals?.pending !== "number"
      || typeof engagement.totals?.overduePending !== "number"
      || typeof engagement.totals?.failed !== "number"
      || typeof engagement.totals?.skipped !== "number"
    ) {
      throw new Error("Diagnostics response missing engagement summary");
    }
    return `status=${(data as any).status} build=${source.shortCommit} checkout=${source.checkout.shortCommit} matchesBuild=${source.checkoutMatchesBuild} migrations=${migrationDrift.codeLatestId}/${migrationDrift.databaseLatestId} membershipOpen=${membershipProcessing.openCount} gamification=${gamification.status} activeChallenges=${gamification.challenges.active} stuckChallenges=${gamification.challenges.stuckCompletions} referralCreditMismatches=${gamification.referrals.referrerCreditMismatches} engagement=${engagement.status} engagementPending=${engagement.totals.pending} engagementOverdue=${engagement.totals.overduePending} engagementFailed=${engagement.totals.failed}`;
  }));

  results.push(await runTest("API Diagnostics: missing token envelope", async () => {
    const requestId = `debug-missing-token-${runId}`;
    const data = await api.expectDiagnosticError({
      path: "/api/v1/admin/restaurants",
      expectedStatus: 401,
      expectedCode: "AUTH_TOKEN_MISSING",
      requestId,
    });
    return `code=${String(data.code)} requestId=${String(data.requestId)}`;
  }));

  results.push(await runTest("API Diagnostics: route not found envelope", async () => {
    const requestId = `debug-route-not-found-${runId}`;
    const token = await api.getSuperAdminToken();
    const data = await api.expectDiagnosticError({
      path: "/api/v1/debug/not-found",
      expectedStatus: 404,
      expectedCode: "ROUTE_NOT_FOUND",
      requestId,
      token,
    });
    return `code=${String(data.code)} requestId=${String(data.requestId)}`;
  }));

  results.push(await runTest("API Diagnostics: validation envelope", async () => {
    const requestId = `debug-validation-${runId}`;
    const data = await api.expectDiagnosticError({
      path: "/api/v1/reservations",
      method: "POST",
      body: {},
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR",
      requestId,
    });
    if (!data.details || typeof data.details !== "object") {
      throw new Error("Validation envelope missing details");
    }
    return `code=${String(data.code)} requestId=${String(data.requestId)}`;
  }));

  // 2. List restaurants
  results.push(await runTest("List Restaurants", async () => {
    const data = await api.listRestaurants();
    const count = (data as unknown as Array<unknown>).length;
    return `${count} restaurant(s)`;
  }));

  // 3. Check availability
  results.push(await runTest("Check Availability", async () => {
    for (let offset = 10; offset < 40; offset += 1) {
      const candidateDate = plusDays(offset);
      const data = await api.getAvailability(RESTAURANT_ID, candidateDate, 2);
      const slots = (data as any).slots as Array<{ time?: string }>;
      const nextSlots = slots?.map((slot) => slot.time).filter((time): time is string => !!time) ?? [];
      if (nextSlots.length >= 3) {
        reservationDate = candidateDate;
        availabilitySlots = nextSlots;
        return `${availabilitySlots.length} slots available on ${reservationDate}`;
      }
    }
    throw new Error("No suitable availability date returned");
  }));

  // 4. Create reservation
  results.push(await runTest("Create Reservation", async () => {
    const data = await createReservationUsingAvailableSlot({
      guestName: `E2E ${runId}`,
      guestPhone,
      notes: runId,
      source: "web",
    });
    const res = (data as any).reservation;
    reservationId = res.id;
    guestId = res.guestId;
    return `id=${res.id.slice(0, 8)}... status=${res.status}`;
  }));

  // 5. List reservations
  results.push(await runTest("List Reservations", async () => {
    const data = await api.listReservations(RESTAURANT_ID, reservationDate);
    const list = (data as any).reservations as Array<unknown>;
    return `${list.length} reservations on ${reservationDate}`;
  }));

  // 6. Confirm → Seat → Complete with lifecycle timestamps
  for (const status of ["confirmed", "seated", "completed"] as const) {
    results.push(await runTest(`Update Status: ${status}`, async () => {
      if (!reservationId) throw new Error("No reservation to update");
      const data = await api.updateReservation(reservationId, { status });
      const reservation = (data as any).reservation;
      const timestampKey = `${status}At`;
      if (!reservation[timestampKey]) {
        throw new Error(`Missing lifecycle timestamp ${timestampKey}`);
      }
      return `status=${reservation.status} ${timestampKey}=${reservation[timestampKey]}`;
    }));
  }

  // 7. Create and mark no-show
  results.push(await runTest("Create Reservation for No-Show", async () => {
    const data = await createReservationUsingAvailableSlot({
      guestName: `No Show ${runId}`,
      guestPhone: `052${String(Date.now()).slice(-7)}`,
      notes: `${runId}-no-show`,
      source: "phone",
    });
    const res = (data as any).reservation;
    noShowReservationId = res.id;
    noShowGuestId = res.guestId;
    return `id=${res.id.slice(0, 8)}... status=${res.status}`;
  }));

  results.push(await runTest("Mark No-Show", async () => {
    if (!noShowReservationId || !noShowGuestId) throw new Error("No reservation to mark no-show");
    const before = await api.getGuestProfile(noShowGuestId);
    const beforeCount = (before as any).profile?.guest?.noShowCount ?? 0;

    const data = await api.markNoShow(noShowReservationId);
    const reservation = (data as any).reservation;
    if (!reservation.noShowAt) {
      throw new Error("Missing noShowAt timestamp");
    }

    const after = await api.getGuestProfile(noShowGuestId);
    const afterCount = (after as any).profile?.guest?.noShowCount ?? 0;
    if (afterCount !== beforeCount + 1) {
      throw new Error(`Expected noShowCount ${beforeCount + 1}, got ${afterCount}`);
    }

    return `status=${reservation.status} noShowAt=${reservation.noShowAt} noShowCount=${afterCount}`;
  }));

  results.push(await runTest("Create Reservation for PATCH No-Show", async () => {
    const data = await createReservationUsingAvailableSlot({
      guestName: `Patch No Show ${runId}`,
      guestPhone: `055${String(Date.now()).slice(-7)}`,
      notes: `${runId}-patch-no-show`,
      source: "phone",
    });
    const res = (data as any).reservation;
    patchNoShowReservationId = res.id;
    patchNoShowGuestId = res.guestId;
    return `id=${res.id.slice(0, 8)}... status=${res.status}`;
  }));

  results.push(await runTest("Patch Status: no_show", async () => {
    if (!patchNoShowReservationId || !patchNoShowGuestId) throw new Error("No reservation to patch no-show");
    const before = await api.getGuestProfile(patchNoShowGuestId);
    const beforeCount = (before as any).profile?.guest?.noShowCount ?? 0;

    const data = await api.updateReservation(patchNoShowReservationId, { status: "no_show" });
    const reservation = (data as any).reservation;
    if (!reservation.noShowAt) {
      throw new Error("Missing noShowAt timestamp after PATCH");
    }

    const after = await api.getGuestProfile(patchNoShowGuestId);
    const afterCount = (after as any).profile?.guest?.noShowCount ?? 0;
    if (afterCount !== beforeCount + 1) {
      throw new Error(`Expected PATCH noShowCount ${beforeCount + 1}, got ${afterCount}`);
    }

    return `status=${reservation.status} noShowAt=${reservation.noShowAt} noShowCount=${afterCount}`;
  }));

  // 8. Loyalty balance
  results.push(await runTest("Loyalty Balance", async () => {
    if (!guestId) throw new Error("No guest");
    const data = await api.getLoyaltyBalance(guestId);
    return `points=${(data as any).pointsBalance} tier=${(data as any).tier}`;
  }));

  results.push(await runTest("Group Host Bonus", async () => {
    const groupAvailability = await api.getAvailability(RESTAURANT_ID, reservationDate, 6);
    const groupSlots = ((groupAvailability as any).slots as Array<{ time?: string }> | undefined)
      ?.map((slot) => slot.time)
      .filter((time): time is string => !!time) ?? [];
    if (groupSlots.length === 0) {
      throw new Error(`No group availability on ${reservationDate}`);
    }

    const originalSlots = availabilitySlots;
    availabilitySlots = groupSlots;
    try {
      const data = await createReservationUsingAvailableSlot({
        guestName: `Group Host ${runId}`,
        guestPhone: `058${String(Date.now()).slice(-7)}`,
        notes: `${runId}-group-host`,
        source: "web",
        partySize: 6,
      });
      const reservation = (data as any).reservation;
      await api.updateReservation(reservation.id, { status: "seated" });
      await api.updateReservation(reservation.id, { status: "completed" });
      const history = await api.getLoyaltyHistory(reservation.guestId);
      const transactions = (history as any).transactions as Array<{ reason?: string; points?: number }>;
      const hostBonus = transactions.find((tx) => tx.reason === "host_group_bonus");
      if (!hostBonus || hostBonus.points !== 20) {
        throw new Error(`Expected host_group_bonus=20, got ${JSON.stringify(hostBonus)}`);
      }
      return `guest=${reservation.guestId.slice(0, 8)}... hostBonus=${hostBonus.points}`;
    } finally {
      availabilitySlots = originalSlots;
    }
  }));

  // 9. Create reward for membership claim flow
  results.push(await runTest("Create Reward", async () => {
    const data = await api.createReward({
      restaurantId: RESTAURANT_ID,
      nameHe: `Reward ${runId}`,
      description: `Reward for ${runId}`,
      pointsCost: 10,
      templateKey: rewardTemplateKey,
      recommendedMoments: rewardRecommendedMoments,
      pitchHe: rewardPitchHe,
      pitchEn: rewardPitchEn,
    });
    const reward = (data as any).reward;
    rewardId = reward.id;
    if (reward.templateKey !== rewardTemplateKey) {
      throw new Error(`Expected templateKey ${rewardTemplateKey}, got ${reward.templateKey}`);
    }
    if (!Array.isArray(reward.recommendedMoments) || !reward.recommendedMoments.includes("referral")) {
      throw new Error(`Expected referral moment on created reward, got ${JSON.stringify(reward.recommendedMoments)}`);
    }
    if (reward.pitchHe !== rewardPitchHe || reward.pitchEn !== rewardPitchEn) {
      throw new Error("Reward pitch metadata did not persist on create");
    }
    return `rewardId=${rewardId.slice(0, 8)}... template=${reward.templateKey}`;
  }));

  results.push(await runTest("Update Reward Metadata", async () => {
    if (!rewardId) throw new Error("No reward to update");
    rewardTemplateKey = "starter-for-table";
    rewardRecommendedMoments = ["referral", "group"];
    rewardPitchHe = `תבואו עם חברים ויש לכם מנה ראשונה עלינו. ${runId}`;
    rewardPitchEn = `Bring a few friends and the table gets a starter on us. ${runId}`;

    const data = await api.updateReward(rewardId, {
      templateKey: rewardTemplateKey,
      recommendedMoments: rewardRecommendedMoments,
      pitchHe: rewardPitchHe,
      pitchEn: rewardPitchEn,
    });
    const reward = (data as any).reward;
    if (reward.templateKey !== rewardTemplateKey) {
      throw new Error(`Expected updated templateKey ${rewardTemplateKey}, got ${reward.templateKey}`);
    }
    if (!Array.isArray(reward.recommendedMoments) || reward.recommendedMoments.length !== 2) {
      throw new Error(`Expected updated recommended moments, got ${JSON.stringify(reward.recommendedMoments)}`);
    }
    if (!reward.recommendedMoments.includes("referral") || !reward.recommendedMoments.includes("group")) {
      throw new Error(`Updated recommended moments missing expected values: ${JSON.stringify(reward.recommendedMoments)}`);
    }
    if (reward.pitchHe !== rewardPitchHe || reward.pitchEn !== rewardPitchEn) {
      throw new Error("Reward pitch metadata did not persist on update");
    }
    return `template=${reward.templateKey} moments=${reward.recommendedMoments.join(",")}`;
  }));

  results.push(await runTest("Membership Access: employee cannot manage rewards", async () => {
    if (!rewardId) throw new Error("No reward");
    await api.expectEmployeeCreateRewardForbidden({
      restaurantId: RESTAURANT_ID,
      nameHe: `Employee Forbidden ${runId}`,
      pointsCost: 1,
    });
    await api.expectEmployeeUpdateRewardForbidden(rewardId, {
      nameHe: `Employee Patch Forbidden ${runId}`,
    });
    return "create=403 update=403";
  }));

  results.push(await runTest("Membership Access: employee cannot retry processing failures", async () => {
    await api.expectEmployeeProcessingFailuresForbidden(RESTAURANT_ID);
    return "processingFailures=403";
  }));

  // 10. Membership summary
  results.push(await runTest("Membership Summary", async () => {
    if (!guestId) throw new Error("No guest");
    const data = await api.getMembershipSummary(guestId);
    const summary = (data as any).summary;
    if (!summary?.loyalty || !summary?.rewards || !summary?.referrals || !summary?.streak) {
      throw new Error("Membership summary missing expected sections");
    }
    const reward = (summary.rewards.available as Array<any>).find((item) => item.id === rewardId);
    if (!reward) {
      throw new Error("Created reward missing from membership summary");
    }
    if (reward.templateKey !== rewardTemplateKey) {
      throw new Error(`Expected summary templateKey ${rewardTemplateKey}, got ${reward.templateKey}`);
    }
    if (!Array.isArray(reward.recommendedMoments) || !reward.recommendedMoments.includes("referral")) {
      throw new Error(`Expected summary reward moments to include referral, got ${JSON.stringify(reward.recommendedMoments)}`);
    }
    if (reward.pitchHe !== rewardPitchHe || reward.pitchEn !== rewardPitchEn) {
      throw new Error("Summary reward pitch metadata mismatch");
    }
    return `points=${summary.loyalty.pointsBalance} template=${reward.templateKey} optedOut=${summary.optedOutCampaigns}`;
  }));

  // 11. Claim reward
  results.push(await runTest("Claim Reward", async () => {
    if (!guestId || !rewardId) throw new Error("Missing guest or reward");
    const data = await api.claimReward(guestId, rewardId, { reservationId });
    const claim = (data as any).claim;
    rewardClaimId = claim.id;
    rewardClaimCode = claim.claimCode;
    if (claim.status !== "active") {
      throw new Error(`Expected active claim, got ${claim.status}`);
    }
    return `claimId=${claim.id.slice(0, 8)}... code=${claim.claimCode}`;
  }));

  // 12. Verify reward claim
  results.push(await runTest("Employee Verify Reward Claim", async () => {
    if (!rewardClaimCode) throw new Error("No reward claim code");
    const data = await api.verifyRewardClaimAsEmployee(rewardClaimCode);
    const claim = (data as any).claim;
    if (claim.status !== "active") {
      throw new Error(`Expected active claim during verification, got ${claim.status}`);
    }
    return `guest=${claim.guestName} reward=${claim.rewardName}`;
  }));

  // 13. Redeem reward claim
  results.push(await runTest("Employee Redeem Reward Claim", async () => {
    if (!rewardClaimId) throw new Error("No reward claim id");
    const data = await api.redeemRewardClaimAsEmployee(rewardClaimId);
    const claim = (data as any).claim;
    if (claim.status !== "redeemed" || !claim.redeemedAt) {
      throw new Error("Claim was not redeemed correctly");
    }
    return `status=${claim.status} redeemedAt=${claim.redeemedAt}`;
  }));

  // 14. Update messaging preferences
  results.push(await runTest("Update Messaging Preferences", async () => {
    if (!guestId) throw new Error("No guest");
    const data = await api.updateMessagingPreferences(guestId, true);
    const guest = (data as any).guest;
    if (!guest?.optedOutCampaigns) {
      throw new Error("Expected optedOutCampaigns to be true");
    }
    const summary = await api.getMembershipSummary(guestId);
    const updatedSummary = (summary as any).summary;
    if (!updatedSummary?.optedOutCampaigns) {
      throw new Error("Membership summary did not reflect messaging opt-out");
    }

    const guestProfile = await api.getGuest(guestId);
    const updatedGuest = ((guestProfile as any).guest ?? guestProfile) as { optedOutCampaigns?: boolean };
    if (!updatedGuest.optedOutCampaigns) {
      throw new Error("Guest API did not reflect messaging opt-out");
    }

    return `optedOut=${guest.optedOutCampaigns} summaryOptedOut=${updatedSummary.optedOutCampaigns}`;
  }));

  results.push(await runTest("Opt-out skips promotional engagement", async () => {
    if (!guestId) throw new Error("No guest");

    for (let i = 0; i < 2; i++) {
      const data = await createReservationUsingAvailableSlot({
        guestName: `E2E ${runId}`,
        guestPhone,
        notes: `${runId}-optout-${i}`,
        source: "web",
      });
      const reservation = (data as any).reservation;
      await api.updateReservation(reservation.id, { status: "seated" });
      // Positive feedback linked to this reservation, so completing it schedules
      // a review_request — which is then skipped because the guest is opted out.
      await api.submitFeedback({
        guestId: reservation.guestId ?? guestId,
        restaurantId: RESTAURANT_ID,
        reservationId: reservation.id,
        rating: 5,
        channel: "web",
      });
      await api.updateReservation(reservation.id, { status: "completed" });
    }

    const data = await api.listEngagementJobs(RESTAURANT_ID, {
      guestId,
      status: "skipped",
      messageCategory: "promotional",
    });
    const skippedJobs = (data as any).jobs as Array<{ type?: string; skipReason?: string }>;
    const reviewSkip = skippedJobs.find((job) => job.type === "review_request");
    if (!reviewSkip) {
      throw new Error(`Expected skipped review_request, got ${JSON.stringify(skippedJobs)}`);
    }
    if (reviewSkip.skipReason !== "guest_opted_out_promotional") {
      throw new Error(`Expected opt-out skip reason, got ${reviewSkip.skipReason}`);
    }

    return `type=${reviewSkip.type} reason=${reviewSkip.skipReason}`;
  }));

  results.push(await runTest("Restore Messaging Preferences", async () => {
    if (!guestId) throw new Error("No guest");
    const data = await api.updateMessagingPreferencesAsEmployee(guestId, false);
    const guest = (data as any).guest;
    if (guest?.optedOutCampaigns) {
      throw new Error("Expected optedOutCampaigns to be false after restore");
    }

    const summary = await api.getMembershipSummary(guestId);
    const updatedSummary = (summary as any).summary;
    if (updatedSummary?.optedOutCampaigns) {
      throw new Error("Membership summary still shows optedOutCampaigns=true after restore");
    }

    return `optedOut=${guest.optedOutCampaigns}`;
  }));

  // 15. Log a visit
  results.push(await runTest("Create Visit", async () => {
    if (!guestId) throw new Error("No guest");
    const data = await api.createVisit({
      guestId,
      restaurantId: RESTAURANT_ID,
      reservationId,
      date: today,
      partySize: 2,
      items: [
        { name: "Shakshuka", category: "main", price: 52, rating: 5 },
        { name: "Lemonade", category: "drink", price: 18, rating: 4 },
      ],
      totalSpend: 70,
      feedback: `Great meal! ${runId}`,
      rating: 5,
      channel: "web",
    });
    return `visitId=${(data as any).visit.id.slice(0, 8)}...`;
  }));

  // 9. Guest full profile
  results.push(await runTest("Guest Full Profile", async () => {
    if (!guestId) throw new Error("No guest");
    const data = await api.getGuestProfile(guestId);
    const p = (data as any).profile;
    return `visits=${p.visitHistory?.length ?? 0} tags=${p.guest?.tags?.join(",") || "none"}`;
  }));

  // 10. Table status
  results.push(await runTest("Table Status", async () => {
    const data = await api.getTableStatus(RESTAURANT_ID);
    const tables = data as unknown as Array<unknown>;
    return `${tables.length} tables`;
  }));

  // 11. Dashboard snapshot
  results.push(await runTest("Dashboard Snapshot", async () => {
    const data = await api.getDashboard(RESTAURANT_ID);
    const t = (data as any).today;
    return `reservations=${t.reservations} covers=${t.covers}`;
  }));

  // 12. Waitlist flow
  results.push(await runTest("Add to Waitlist", async () => {
    const data = await api.addToWaitlist({
      restaurantId: RESTAURANT_ID,
      guestName: `WL ${runId}`,
      guestPhone: `051${String(Date.now()).slice(-7)}`,
      date: reservationDate,
      preferredTimeStart: requireSlot(0),
      preferredTimeEnd: requireSlot(Math.min(2, availabilitySlots.length - 1)),
      partySize: 3,
    });
    const entry = (data as any).waitlistEntry || (data as any).entry || (data as any).waitlist;
    if (!entry?.id) throw new Error("No waitlist entry returned");
    return `waitlistId=${entry.id.slice(0, 8)}... status=${entry.status}`;
  }));

  // 13. List waitlist
  results.push(await runTest("List Waitlist", async () => {
    const data = await api.listWaitlist(RESTAURANT_ID, reservationDate);
    const list = (data as any).waitlist as Array<unknown>;
    return `${list?.length ?? 0} entries`;
  }));

  // 14. Walk-in creation (confirmed)
  results.push(await runTest("Create Walk-In", async () => {
    for (let offset = 10; offset < 40; offset += 1) {
      const date = plusDays(offset);
      const availability = await api.getAvailability(RESTAURANT_ID, date, 2);
      const slot = (availability as any).slots?.[0]?.time;
      if (!slot) continue;

      try {
        const data = await api.createWalkIn({
          restaurantId: RESTAURANT_ID,
          guestName: `Walk In ${runId}`,
          guestPhone: `053${String(Date.now()).slice(-7)}`,
          date,
          timeStart: slot,
          partySize: 2,
          notes: `${runId}-walk-in`,
        });
        const reservation = (data as any).reservation;
        if (reservation.status !== "confirmed") {
          throw new Error(`Expected confirmed walk-in, got ${reservation.status}`);
        }
        if (!reservation.confirmedAt || reservation.seatedAt) {
          throw new Error("Walk-in confirmation timestamps are incorrect");
        }
        return `status=${reservation.status} confirmedAt=${reservation.confirmedAt}`;
      } catch (err) {
        if (err instanceof Error && err.message.includes('409')) {
          continue;
        }
        throw err;
      }
    }

    throw new Error('No creatable walk-in slot found');
  }));

  // 15. Walk-in creation (immediately seated)
  results.push(await runTest("Create Walk-In Immediate Seat", async () => {
    for (let offset = 11; offset < 41; offset += 1) {
      const date = plusDays(offset);
      const availability = await api.getAvailability(RESTAURANT_ID, date, 2);
      const slot = (availability as any).slots?.[0]?.time;
      if (!slot) continue;

      try {
        const data = await api.createWalkIn({
          restaurantId: RESTAURANT_ID,
          guestName: `Walk In Seat ${runId}`,
          guestPhone: `054${String(Date.now()).slice(-7)}`,
          date,
          timeStart: slot,
          partySize: 2,
          notes: `${runId}-walk-in-seat`,
          seatImmediately: true,
        });
        const reservation = (data as any).reservation;
        if (reservation.status !== "seated") {
          throw new Error(`Expected seated walk-in, got ${reservation.status}`);
        }
        if (!reservation.confirmedAt || !reservation.seatedAt) {
          throw new Error("Immediate-seat walk-in timestamps are incorrect");
        }
        return `status=${reservation.status} seatedAt=${reservation.seatedAt}`;
      } catch (err) {
        if (err instanceof Error && err.message.includes('409')) {
          continue;
        }
        throw err;
      }
    }

    throw new Error('No creatable immediate-seat walk-in slot found');
  }));

  // Build summary
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const totalMs = results.reduce((s, r) => s + r.durationMs, 0);

  const lines = results.map((r) =>
    `${r.pass ? "\u2705" : "\u274C"} ${r.name} (${r.durationMs}ms)\n   ${r.detail}`
  );

  const summary = [
    `\u{1F9EA} OpenSeat E2E — ${new Date().toISOString().slice(0, 16)}`,
    `Run: ${runId}`,
    `Result: ${passed}/${results.length} passed${failed ? ` (${failed} failed)` : ""} in ${totalMs}ms`,
    "",
    ...lines,
  ].join("\n");

  return {
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    apiUrl,
    total: results.length,
    passed,
    failed,
    totalMs,
    environment: {
      cwd: process.cwd(),
      nodeVersion: process.version,
      pid: process.pid,
    },
    results,
    summary,
  };
}

// CLI mode
if (process.argv[1]?.endsWith("test-runner.ts") || process.argv[1]?.endsWith("test-runner.js")) {
  runAllTests()
    .then(async (report) => {
      const { summary, results } = report;
      const artifactPath = await writeRunArtifact(report);
      console.log(summary);
      console.log(`\nArtifact: ${artifactPath}`);
      const failed = results.filter((r) => !r.pass);
      process.exit(failed.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Fatal:", err);
      process.exit(2);
    });
}
