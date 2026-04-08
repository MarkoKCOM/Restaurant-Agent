#!/usr/bin/env node
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
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${res.statusText}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }

  return data;
}

function plusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const runId = `smoke-${Date.now()}`;
const reservationDate = plusDays(1);
const visitDate = plusDays(0);

const report = { baseUrl, runId, steps: [] };
function record(step, details) {
  report.steps.push({ step, ...details });
}

const login = await request("/api/v1/auth/login", {
  method: "POST",
  body: { email: adminEmail, password: adminPassword },
});
record("login", { restaurantId: login.restaurant?.id });

const token = login.token;
const restaurantId = login.restaurant.id;
const restaurants = await request("/api/v1/restaurants");
record("restaurants.list", { count: restaurants.length });

const availability = await request(`/api/v1/reservations/availability?restaurantId=${restaurantId}&date=${reservationDate}&partySize=2`);
if (!availability.slots?.length) throw new Error("No availability slots returned");
const slot = availability.slots[0];
record("reservations.availability", { slotCount: availability.slots.length, chosenSlot: slot.time });

const guestPhone = `050${String(Date.now()).slice(-7)}`;
const guestName = `Smoke Test ${runId}`;
const created = await request("/api/v1/reservations", {
  method: "POST",
  body: {
    restaurantId,
    guestName,
    guestPhone,
    date: reservationDate,
    timeStart: slot.time,
    partySize: 2,
    notes: runId,
    source: "web",
  },
});
const reservation = created.reservation;
record("reservations.create", { reservationId: reservation.id, guestId: reservation.guestId, status: reservation.status });

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
record("loyalty.balance", { pointsBalance: loyalty.pointsBalance, tier: loyalty.tier, visits: loyalty.stampCard?.visits });

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

console.log(JSON.stringify(report, null, 2));
