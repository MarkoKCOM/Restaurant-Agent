/**
 * OpenSeat Extended E2E Tests
 *
 * Covers endpoints NOT covered by the original test-runner:
 * - Guest CRUD, auto-tagging, sentiment
 * - Table management (create, update, delete)
 * - Reservation cancellation + waitlist offer/accept flow
 * - Loyalty awards, history, stamp card, rewards list
 * - Feedback submission + summary
 * - Gamification: referrals, challenges, streaks
 * - Engagement jobs + win-back trigger
 * - Restaurant settings update + daily summary
 * - Admin endpoints
 * - Visit history
 */

import * as api from "./api-client.js";

const RESTAURANT_ID = "c3c22e37-a309-4fde-aa6c-6e714212a3bc";

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
  durationMs: number;
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

export async function runExtendedTests(): Promise<{ results: TestResult[]; summary: string }> {
  const results: TestResult[] = [];
  const phone = `051${String(Date.now()).slice(-7)}`;
  const phone2 = `052${String(Date.now()).slice(-7)}`;
  const today = plusDays(0);
  const futureDate = plusDays(15);

  let guestId = "";
  let guest2Id = "";
  let tableId = "";
  let reservationId = "";
  let waitlistId = "";
  let challengeId = "";
  let referralCode = "";

  // ── Restaurant Endpoints ─────────────────────────────

  results.push(await runTest("Get single restaurant", async () => {
    const r = await api.getRestaurant(RESTAURANT_ID) as Record<string, unknown>;
    if (!r.id) throw new Error("Missing restaurant id");
    return `name=${r.name}`;
  }));

  results.push(await runTest("Update restaurant description", async () => {
    const desc = `E2E test ${Date.now()}`;
    const r = await api.updateRestaurant(RESTAURANT_ID, { description: desc }) as Record<string, unknown>;
    if (r.description !== desc) throw new Error(`Description mismatch`);
    return `updated`;
  }));

  results.push(await runTest("Get daily summary", async () => {
    const r = await api.getDailySummary(RESTAURANT_ID) as Record<string, unknown>;
    if (r.totalReservations === undefined) throw new Error("Missing totalReservations");
    return `reservations=${r.totalReservations}`;
  }));

  // ── Guest CRUD ───────────────────────────────────────

  results.push(await runTest("Create guest", async () => {
    const r = await api.createGuest({ restaurantId: RESTAURANT_ID, name: "E2E Guest", phone, email: "e2e@test.com" }) as Record<string, unknown>;
    const g = (r.guest ?? r) as Record<string, unknown>;
    guestId = g.id as string;
    if (!guestId) throw new Error("No guest id");
    return `guestId=${guestId}`;
  }));

  results.push(await runTest("Get guest by ID", async () => {
    const r = await api.getGuest(guestId) as Record<string, unknown>;
    const g = (r.guest ?? r) as Record<string, unknown>;
    if (g.id !== guestId) throw new Error("Guest id mismatch");
    return `name=${g.name}`;
  }));

  results.push(await runTest("List guests", async () => {
    const r = await api.listGuests(RESTAURANT_ID) as Record<string, unknown>;
    const guests = r.guests as unknown[];
    if (!Array.isArray(guests) || guests.length === 0) throw new Error("No guests");
    return `count=${guests.length}`;
  }));

  results.push(await runTest("Update guest tags", async () => {
    const r = await api.updateGuest(guestId, { tags: ["e2e-test", "vip"] }) as Record<string, unknown>;
    const g = (r.guest ?? r) as Record<string, unknown>;
    const tags = g.tags as string[];
    if (!tags?.includes("e2e-test")) throw new Error("Tag not set");
    return `tags=${JSON.stringify(tags)}`;
  }));

  results.push(await runTest("Auto-tag guest", async () => {
    await api.autoTagGuest(guestId);
    return `ok`;
  }));

  results.push(await runTest("Get guest sentiment", async () => {
    await api.getGuestSentiment(guestId);
    return `ok`;
  }));

  results.push(await runTest("Create second guest", async () => {
    const r = await api.createGuest({ restaurantId: RESTAURANT_ID, name: "E2E Referral", phone: phone2 }) as Record<string, unknown>;
    const g = (r.guest ?? r) as Record<string, unknown>;
    guest2Id = g.id as string;
    if (!guest2Id) throw new Error("No guest2 id");
    return `guest2Id=${guest2Id}`;
  }));

  // ── Table Management ─────────────────────────────────

  results.push(await runTest("List tables", async () => {
    const r = await api.listTables(RESTAURANT_ID) as Record<string, unknown>;
    const tables = r.tables as unknown[];
    if (!Array.isArray(tables)) throw new Error("tables not array");
    return `count=${tables.length}`;
  }));

  results.push(await runTest("Create table", async () => {
    const r = await api.createTable({ restaurantId: RESTAURANT_ID, name: `E2E-${Date.now() % 1000}`, minSeats: 2, maxSeats: 4 }) as Record<string, unknown>;
    const t = (r.table ?? r) as Record<string, unknown>;
    tableId = t.id as string;
    if (!tableId) throw new Error("No table id");
    return `tableId=${tableId}`;
  }));

  results.push(await runTest("Update table", async () => {
    const r = await api.updateTable(tableId, { maxSeats: 6 }) as Record<string, unknown>;
    const t = (r.table ?? r) as Record<string, unknown>;
    if (t.maxSeats !== 6) throw new Error(`maxSeats=${t.maxSeats}`);
    return `maxSeats=6`;
  }));

  results.push(await runTest("Delete table", async () => {
    await api.deleteTable(tableId);
    return `deactivated`;
  }));

  // ── Cancel + Waitlist Offer/Accept ───────────────────

  results.push(await runTest("Create reservation for cancel", async () => {
    const a = await api.getAvailability(RESTAURANT_ID, futureDate, 2) as Record<string, unknown>;
    const slots = a.slots as Array<{ time: string }>;
    if (!slots?.length) throw new Error("No slots");
    const r = await api.createReservation({ restaurantId: RESTAURANT_ID, guestName: "Cancel Test", guestPhone: `053${String(Date.now()).slice(-7)}`, date: futureDate, timeStart: slots[0]!.time, partySize: 2 }) as Record<string, unknown>;
    const rv = (r.reservation ?? r) as Record<string, unknown>;
    reservationId = rv.id as string;
    return `id=${reservationId}`;
  }));

  results.push(await runTest("Cancel reservation", async () => {
    const r = await api.cancelReservation(reservationId) as Record<string, unknown>;
    const rv = (r.reservation ?? r) as Record<string, unknown>;
    if (rv.status !== "cancelled") throw new Error(`status=${rv.status}`);
    return `cancelled`;
  }));

  // Use a date that's not Friday/Saturday to avoid operating hours conflicts
  const wlDate = (() => {
    for (let i = 15; i < 25; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const day = d.getDay();
      if (day !== 5 && day !== 6) return d.toISOString().slice(0, 10); // skip Fri/Sat
    }
    return futureDate;
  })();

  results.push(await runTest("Waitlist: add", async () => {
    const r = await api.addToWaitlist({ restaurantId: RESTAURANT_ID, guestName: "WL Offer", guestPhone: `054${String(Date.now()).slice(-7)}`, date: wlDate, preferredTimeStart: "19:00", preferredTimeEnd: "21:00", partySize: 2 }) as Record<string, unknown>;
    const wl = (r.waitlistEntry ?? r) as Record<string, unknown>;
    waitlistId = wl.id as string;
    if (!waitlistId) throw new Error("No waitlist id");
    return `id=${waitlistId}`;
  }));

  results.push(await runTest("Waitlist: offer slot", async () => {
    const r = await api.offerWaitlistSlot(waitlistId) as Record<string, unknown>;
    const wl = (r.waitlistEntry ?? r) as Record<string, unknown>;
    if (wl.status !== "offered") throw new Error(`status=${wl.status}`);
    return `offered`;
  }));

  results.push(await runTest("Waitlist: accept offer", async () => {
    const r = await api.acceptWaitlistOffer(waitlistId) as Record<string, unknown>;
    if (!r.reservationId && !r.waitlistEntry) throw new Error("No result from accept");
    return `accepted`;
  }));

  results.push(await runTest("Waitlist: remove entry", async () => {
    const a = await api.addToWaitlist({ restaurantId: RESTAURANT_ID, guestName: "WL Remove", guestPhone: `055${String(Date.now()).slice(-7)}`, date: futureDate, preferredTimeStart: "20:00", preferredTimeEnd: "22:00", partySize: 2 }) as Record<string, unknown>;
    const wl = (a.waitlistEntry ?? a) as Record<string, unknown>;
    await api.removeFromWaitlist(wl.id as string);
    return `removed`;
  }));

  // ── Loyalty: Awards, History, Stamp Card ─────────────

  results.push(await runTest("Award points", async () => {
    await api.awardPoints(guestId, { restaurantId: RESTAURANT_ID, points: 100, reason: "e2e test" });
    return `100 points`;
  }));

  results.push(await runTest("Loyalty history", async () => {
    const r = await api.getLoyaltyHistory(guestId) as Record<string, unknown>;
    const txns = r.transactions as unknown[];
    if (!Array.isArray(txns) || txns.length === 0) throw new Error("No transactions");
    return `count=${txns.length}`;
  }));

  results.push(await runTest("List rewards", async () => {
    const r = await api.listRewards(RESTAURANT_ID) as Record<string, unknown>;
    const rewards = r.rewards as unknown[];
    if (!Array.isArray(rewards)) throw new Error("rewards not array");
    return `count=${rewards.length}`;
  }));

  results.push(await runTest("Stamp card", async () => {
    const r = await api.getStampCard(guestId) as Record<string, unknown>;
    if (r.current === undefined && r.stampCard === undefined) throw new Error("No stamp data");
    return `ok`;
  }));

  // ── Visit History ────────────────────────────────────

  results.push(await runTest("Log visit", async () => {
    await api.createVisit({ guestId, restaurantId: RESTAURANT_ID, date: today, partySize: 2, totalSpend: 180, items: [{ name: "Burger", category: "Main", price: 65, rating: 5 }], rating: 4, feedback: "Great!", channel: "web" });
    return `logged`;
  }));

  results.push(await runTest("Visit history", async () => {
    const r = await api.getVisitHistory(guestId) as Record<string, unknown>;
    const visits = r.visits as unknown[];
    if (!Array.isArray(visits) || visits.length === 0) throw new Error("No visits");
    return `count=${visits.length}`;
  }));

  // ── Feedback ─────────────────────────────────────────

  results.push(await runTest("Submit feedback (public)", async () => {
    await api.submitFeedback({ guestId, restaurantId: RESTAURANT_ID, rating: 5, feedback: "Amazing!", channel: "web" });
    return `submitted`;
  }));

  results.push(await runTest("Feedback summary", async () => {
    const r = await api.getFeedbackSummary(RESTAURANT_ID) as Record<string, unknown>;
    if (!r.summary) throw new Error("No summary");
    return `ok`;
  }));

  // ── Gamification: Referrals ──────────────────────────

  results.push(await runTest("Generate referral code", async () => {
    const r = await api.generateReferralCode(guestId) as Record<string, unknown>;
    referralCode = r.referralCode as string;
    if (!referralCode) throw new Error("No code");
    return `code=${referralCode}`;
  }));

  results.push(await runTest("Apply referral", async () => {
    const r = await api.applyReferral({ guestId: guest2Id, referralCode }) as Record<string, unknown>;
    if (!r.success) throw new Error("Not applied");
    return `applied`;
  }));

  results.push(await runTest("Referral stats", async () => {
    await api.getReferralStats(guestId);
    return `ok`;
  }));

  // ── Gamification: Challenges ─────────────────────────

  results.push(await runTest("Create challenge", async () => {
    const r = await api.createChallenge({ restaurantId: RESTAURANT_ID, name: "E2E Visit Challenge", type: "visit_count", target: 5, reward: 50 }) as Record<string, unknown>;
    const c = (r.challenge ?? r) as Record<string, unknown>;
    challengeId = c.id as string;
    if (!challengeId) throw new Error("No challenge id");
    return `id=${challengeId}`;
  }));

  results.push(await runTest("List challenges", async () => {
    const r = await api.listChallenges(RESTAURANT_ID) as Record<string, unknown>;
    const c = r.challenges as unknown[];
    if (!Array.isArray(c) || c.length === 0) throw new Error("No challenges");
    return `count=${c.length}`;
  }));

  results.push(await runTest("Guest challenges", async () => {
    const r = await api.getGuestChallenges(guestId, RESTAURANT_ID) as Record<string, unknown>;
    if (!r.challenges) throw new Error("No challenges key");
    return `ok`;
  }));

  results.push(await runTest("Increment challenge", async () => {
    await api.incrementChallenge(guestId, challengeId);
    return `incremented`;
  }));

  results.push(await runTest("Get streak", async () => {
    await api.getStreak(guestId);
    return `ok`;
  }));

  // ── Engagement ───────────────────────────────────────

  results.push(await runTest("List engagement jobs", async () => {
    const r = await api.listEngagementJobs(RESTAURANT_ID) as Record<string, unknown>;
    const jobs = r.jobs as unknown[];
    if (!Array.isArray(jobs)) throw new Error("jobs not array");
    return `count=${jobs.length}`;
  }));

  results.push(await runTest("Trigger win-back", async () => {
    await api.triggerWinBack(RESTAURANT_ID);
    return `triggered`;
  }));

  // ── Admin ────────────────────────────────────────────

  // Admin endpoint requires super_admin role — test that non-super gets 403
  results.push(await runTest("Admin: requires super_admin (403)", async () => {
    try {
      await api.getAdminRestaurants();
      throw new Error("Should have been forbidden");
    } catch (err) {
      const msg = String(err);
      if (!msg.includes("403")) throw new Error(`Expected 403, got: ${msg}`);
      return `correctly returned 403`;
    }
  }));

  // ── Summary ──────────────────────────────────────────

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  const lines = results.map((r) =>
    `${r.pass ? "PASS" : "FAIL"} ${r.name} (${r.durationMs}ms)${r.pass ? "" : `\n     ${r.detail}`}`,
  );

  const summary = [
    `Extended E2E: ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ""} (${totalMs}ms)`,
    "",
    ...lines,
  ].join("\n");

  return { results, summary };
}

// CLI entry
if (process.argv[1]?.endsWith("test-extended.ts") || process.argv[1]?.endsWith("test-extended.js")) {
  runExtendedTests()
    .then(({ summary }) => {
      console.log(summary);
      process.exit(summary.includes("FAIL") ? 1 : 0);
    })
    .catch((err) => {
      console.error("Fatal:", err);
      process.exit(1);
    });
}
