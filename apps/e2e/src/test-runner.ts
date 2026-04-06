/**
 * OpenSeat E2E Test Runner
 *
 * Exercises the full API flow and posts results to a Telegram topic.
 * Can run standalone (CLI) or triggered by the bot via /test command.
 */

import * as api from "./api-client.js";

// BFF Raanana restaurant ID (seeded)
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

export async function runAllTests(): Promise<{ results: TestResult[]; summary: string }> {
  const runId = `e2e-${Date.now()}`;
  const results: TestResult[] = [];
  let reservationId = "";
  let guestId = "";
  const guestPhone = `050${String(Date.now()).slice(-7)}`;
  const reservationDate = plusDays(1);
  const today = plusDays(0);

  // 1. Health check
  results.push(await runTest("Health Check", async () => {
    await api.healthCheck();
    return "API is up";
  }));

  // 2. List restaurants
  results.push(await runTest("List Restaurants", async () => {
    const data = await api.listRestaurants();
    const count = (data as unknown as Array<unknown>).length;
    return `${count} restaurant(s)`;
  }));

  // 3. Check availability
  results.push(await runTest("Check Availability", async () => {
    const data = await api.getAvailability(RESTAURANT_ID, reservationDate, 2);
    const slots = (data as any).slots as Array<unknown>;
    if (!slots?.length) throw new Error("No slots returned");
    return `${slots.length} slots available`;
  }));

  // 4. Create reservation
  results.push(await runTest("Create Reservation", async () => {
    const data = await api.createReservation({
      restaurantId: RESTAURANT_ID,
      guestName: `E2E ${runId}`,
      guestPhone,
      date: reservationDate,
      timeStart: "19:00",
      partySize: 2,
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

  // 6. Confirm → Seat → Complete
  for (const status of ["confirmed", "seated", "completed"] as const) {
    results.push(await runTest(`Update Status: ${status}`, async () => {
      if (!reservationId) throw new Error("No reservation to update");
      const data = await api.updateReservation(reservationId, { status });
      return `status=${(data as any).reservation.status}`;
    }));
  }

  // 7. Loyalty balance
  results.push(await runTest("Loyalty Balance", async () => {
    if (!guestId) throw new Error("No guest");
    const data = await api.getLoyaltyBalance(guestId);
    return `points=${(data as any).pointsBalance} tier=${(data as any).tier}`;
  }));

  // 8. Log a visit
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
      preferredTimeStart: "19:00",
      preferredTimeEnd: "21:00",
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

  return { results, summary };
}

// CLI mode
if (process.argv[1]?.endsWith("test-runner.ts") || process.argv[1]?.endsWith("test-runner.js")) {
  runAllTests()
    .then(({ summary, results }) => {
      console.log(summary);
      const failed = results.filter((r) => !r.pass);
      process.exit(failed.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Fatal:", err);
      process.exit(2);
    });
}
