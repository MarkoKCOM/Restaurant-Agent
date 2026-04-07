import { and, eq, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { reservations, restaurants, guests as guestsTable } from "../db/schema.js";
import { reminderQueue } from "../queue/index.js";
import { scheduleThankYou, scheduleReviewRequest } from "./engagement.service.js";
import type {
  AvailabilityQuery,
  AvailabilitySlot,
  CreateReservationInput,
  Reservation as DomainReservation,
} from "@openseat/domain";
import { findOrCreateGuest, toDomainGuest, refreshVisitAutoTags, type GuestRow } from "./guest.service.js";
import {
  getActiveTablesForRestaurant,
  pickBestTablesForParty,
  type TableRow,
} from "./table.service.js";
import { onVisitCompleted } from "./loyalty.service.js";

export type ReservationRow = InferSelectModel<typeof reservations>;

const ACTIVE_RESERVATION_STATUSES: ReservationRow["status"][] = [
  "pending",
  "confirmed",
  "seated",
];

const DEFAULT_RESERVATION_DURATION_MINUTES = 120;
const SLOT_INTERVAL_MINUTES = 30;

function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes: number): string {
  const minutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function getDayKey(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  return days[d.getDay()];
}

function computeReservationEnd(
  timeStart: string,
  durationMinutes = DEFAULT_RESERVATION_DURATION_MINUTES,
): string {
  const start = timeStringToMinutes(timeStart);
  return minutesToTimeString(start + durationMinutes);
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

async function getReservationsForDay(
  restaurantId: string,
  date: string,
): Promise<ReservationRow[]> {
  return db
    .select()
    .from(reservations)
    .where(and(eq(reservations.restaurantId, restaurantId), eq(reservations.date, date)))
    .orderBy(reservations.timeStart);
}

function filterAvailableTablesForSlot(
  tablesForRestaurant: TableRow[],
  existingReservations: ReservationRow[],
  slotStartMinutes: number,
  slotEndMinutes: number,
  options?: { excludeReservationId?: string },
): TableRow[] {
  const occupiedTableIds = new Set<string>();

  for (const res of existingReservations) {
    if (!ACTIVE_RESERVATION_STATUSES.includes(res.status)) continue;
    if (options?.excludeReservationId && res.id === options.excludeReservationId) continue;

    const resStart = timeStringToMinutes(res.timeStart);
    const resEnd = timeStringToMinutes(
      res.timeEnd ?? computeReservationEnd(res.timeStart),
    );

    if (!rangesOverlap(slotStartMinutes, slotEndMinutes, resStart, resEnd)) continue;

    for (const tableId of res.tableIds ?? []) {
      occupiedTableIds.add(tableId);
    }
  }

  return tablesForRestaurant.filter((t) => !occupiedTableIds.has(t.id) && t.isActive);
}

function toDomainReservation(row: ReservationRow, guestRow?: GuestRow): DomainReservation {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    guestId: row.guestId,
    date: row.date,
    timeStart: row.timeStart,
    timeEnd: row.timeEnd ?? undefined,
    partySize: row.partySize,
    tableIds: row.tableIds ?? undefined,
    status: row.status,
    source: row.source,
    notes: row.notes ?? undefined,
    guest: guestRow ? toDomainGuest(guestRow) : undefined,
  };
}

export async function checkAvailability(
  input: AvailabilityQuery,
): Promise<AvailabilitySlot[]> {
  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, input.restaurantId))
    .limit(1);

  if (!restaurant) {
    return [];
  }

  const dayKey = getDayKey(input.date);
  const operatingHours = (restaurant.operatingHours as unknown as Record<
    string,
    { open: string; close: string } | null
  >) ?? {};
  const dayHours = operatingHours[dayKey];

  if (!dayHours) {
    return [];
  }

  const openMinutes = timeStringToMinutes(dayHours.open);
  let closeMinutes = timeStringToMinutes(dayHours.close);
  // Handle overnight hours (e.g. open 17:30, close 01:00)
  if (closeMinutes <= openMinutes) {
    closeMinutes += 24 * 60;
  }

  const allTables = await getActiveTablesForRestaurant(input.restaurantId);
  if (allTables.length === 0) {
    return [];
  }

  const dayReservations = await getReservationsForDay(input.restaurantId, input.date);

  const slots: AvailabilitySlot[] = [];

  for (
    let t = openMinutes;
    t + DEFAULT_RESERVATION_DURATION_MINUTES <= closeMinutes;
    t += SLOT_INTERVAL_MINUTES
  ) {
    const slotStart = t;
    const slotEnd = t + DEFAULT_RESERVATION_DURATION_MINUTES;

    const availableTables = filterAvailableTablesForSlot(
      allTables,
      dayReservations,
      slotStart,
      slotEnd,
    );

    if (availableTables.length === 0) continue;

    const maxPartySize = availableTables.reduce((sum, table) => sum + table.maxSeats, 0);

    if (maxPartySize < input.partySize) continue;

    slots.push({
      time: minutesToTimeString(slotStart),
      availableTables: availableTables.length,
      maxPartySize,
    });
  }

  return slots;
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<DomainReservation> {
  // Reject dates in the past (Asia/Jerusalem timezone)
  const nowInJerusalem = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }),
  );
  const todayStr = [
    nowInJerusalem.getFullYear(),
    String(nowInJerusalem.getMonth() + 1).padStart(2, "0"),
    String(nowInJerusalem.getDate()).padStart(2, "0"),
  ].join("-");

  if (input.date < todayStr) {
    throw new Error("Cannot create a reservation for a date in the past");
  }

  // Operating hours enforcement
  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, input.restaurantId))
    .limit(1);

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  const dayKey = getDayKey(input.date);
  const operatingHours = (restaurant.operatingHours as unknown as Record<
    string,
    { open: string; close: string } | null
  >) ?? {};
  const dayHours = operatingHours[dayKey];

  if (!dayHours) {
    throw new Error(`Restaurant is closed on ${dayKey}. No operating hours defined for this day.`);
  }

  let requestedStartMinutes = timeStringToMinutes(input.timeStart);
  const openMinutes = timeStringToMinutes(dayHours.open);
  let closeMinutes = timeStringToMinutes(dayHours.close);
  // Handle overnight hours (e.g. open 17:30, close 01:00)
  if (closeMinutes <= openMinutes) {
    closeMinutes += 24 * 60;
  }
  // Handle late-night bookings (e.g. 00:30 when open is 17:30)
  if (requestedStartMinutes < openMinutes) {
    requestedStartMinutes += 24 * 60;
  }
  const requestedEndMinutes = requestedStartMinutes + DEFAULT_RESERVATION_DURATION_MINUTES;

  if (requestedStartMinutes < openMinutes || requestedEndMinutes > closeMinutes) {
    throw new Error(
      `Requested time ${input.timeStart} is outside operating hours (${dayHours.open}–${dayHours.close}) for ${dayKey}.`,
    );
  }

  const guestSource: GuestRow["source"] =
    input.source === "phone" || !input.source ? "web" : input.source;

  const guestRow = await findOrCreateGuest({
    restaurantId: input.restaurantId,
    name: input.guestName,
    phone: input.guestPhone,
    email: undefined,
    language: "he",
    source: guestSource,
  });

  const dayReservations = await getReservationsForDay(input.restaurantId, input.date);
  const allTables = await getActiveTablesForRestaurant(input.restaurantId);

  const startMinutes = timeStringToMinutes(input.timeStart);
  const endMinutes = startMinutes + DEFAULT_RESERVATION_DURATION_MINUTES;

  const availableTables = filterAvailableTablesForSlot(
    allTables,
    dayReservations,
    startMinutes,
    endMinutes,
  );

  if (availableTables.length === 0) {
    throw new Error("No tables available for requested time");
  }

  const tableIds = pickBestTablesForParty(availableTables, input.partySize);
  if (!tableIds) {
    throw new Error("No suitable table combination found for party size");
  }

  const timeEnd = computeReservationEnd(input.timeStart);

  const [inserted] = await db
    .insert(reservations)
    .values({
      restaurantId: input.restaurantId,
      guestId: guestRow.id,
      date: input.date,
      timeStart: input.timeStart,
      timeEnd,
      partySize: input.partySize,
      tableIds,
      status: "confirmed",
      source: input.source ?? "web",
      notes: input.notes,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to create reservation");
  }

  // Schedule reminder 3 hours before reservation
  try {
    const resDateTime = new Date(`${input.date}T${input.timeStart}:00`);
    const reminderTime = new Date(resDateTime.getTime() - 3 * 60 * 60 * 1000);
    const delay = reminderTime.getTime() - Date.now();
    if (delay > 0) {
      await reminderQueue.add(
        "reminder",
        {
          reservationId: inserted.id,
          restaurantId: input.restaurantId,
          guestId: guestRow.id,
          guestPhone: guestRow.phone,
          date: input.date,
          timeStart: input.timeStart,
          partySize: input.partySize,
        },
        { delay, jobId: `reminder-${inserted.id}` },
      );
    }
  } catch {
    // Non-critical — don't fail reservation if reminder scheduling fails
  }

  return toDomainReservation(inserted, guestRow);
}

export async function listReservations(params: {
  restaurantId?: string;
  date?: string;
}): Promise<DomainReservation[]> {
  const { restaurantId, date } = params;

  const conditions = [] as any[];

  if (restaurantId) {
    conditions.push(eq(reservations.restaurantId, restaurantId));
  }

  if (date) {
    conditions.push(eq(reservations.date, date));
  }

  const baseQuery = conditions.length > 0
    ? db.select().from(reservations).where(and(...conditions))
    : db.select().from(reservations);

  const rows = await baseQuery.orderBy(
    reservations.date,
    reservations.timeStart,
  );

  const results: DomainReservation[] = [];
  for (const row of rows) {
    const [guest] = await db.select().from(guestsTable).where(eq(guestsTable.id, row.guestId)).limit(1);
    results.push(toDomainReservation(row, guest ?? undefined));
  }
  return results;
}

async function getReservationRowById(id: string): Promise<ReservationRow | undefined> {
  const [row] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, id))
    .limit(1);
  return row;
}

export interface UpdateReservationInput {
  date?: string;
  timeStart?: string;
  partySize?: number;
  status?: ReservationRow["status"];
  notes?: string;
  tableIds?: string[];
  cancellationReason?: string | null;
}

export async function updateReservation(
  id: string,
  input: UpdateReservationInput,
): Promise<DomainReservation | null> {
  const existing = await getReservationRowById(id);
  if (!existing) return null;

  const newDate = input.date ?? existing.date;
  const newTimeStart = input.timeStart ?? existing.timeStart;
  const newPartySize = input.partySize ?? existing.partySize;

  let newTableIds = input.tableIds ?? existing.tableIds ?? [];

  const requiresReassignment =
    !!input.date || !!input.timeStart || !!input.partySize || newTableIds.length === 0;

  if (requiresReassignment) {
    const dayReservations = await getReservationsForDay(existing.restaurantId, newDate);
    const allTables = await getActiveTablesForRestaurant(existing.restaurantId);

    const startMinutes = timeStringToMinutes(newTimeStart);
    const endMinutes = startMinutes + DEFAULT_RESERVATION_DURATION_MINUTES;

    const availableTables = filterAvailableTablesForSlot(
      allTables,
      dayReservations,
      startMinutes,
      endMinutes,
      { excludeReservationId: id },
    );

    const picked = pickBestTablesForParty(availableTables, newPartySize);
    if (!picked) {
      throw new Error("No suitable table combination found for updated reservation");
    }

    newTableIds = picked;
  }

  const timeEnd = computeReservationEnd(newTimeStart);

  const newStatus = input.status ?? existing.status;

  const [updated] = await db
    .update(reservations)
    .set({
      date: newDate,
      timeStart: newTimeStart,
      timeEnd,
      partySize: newPartySize,
      tableIds: newTableIds,
      status: newStatus,
      notes: input.notes ?? existing.notes,
      cancellationReason:
        input.cancellationReason !== undefined
          ? input.cancellationReason
          : existing.cancellationReason,
      updatedAt: new Date(),
    })
    .where(eq(reservations.id, id))
    .returning();

  if (!updated) return null;

  // Track visit completion: increment visitCount and update lastVisitDate
  if (newStatus === "completed" && existing.status !== "completed") {
    const today = new Date().toISOString().slice(0, 10);
    await db
      .update(guestsTable)
      .set({
        visitCount: sql`${guestsTable.visitCount} + 1`,
        lastVisitDate: today,
        updatedAt: new Date(),
      })
      .where(eq(guestsTable.id, updated.guestId));

    // Auto-tag guest based on new visit count
    try {
      await refreshVisitAutoTags(updated.guestId);
    } catch {
      // Non-critical — don't fail reservation update if auto-tagging fails
    }

    // Loyalty: award points, check stamp card, evaluate tier
    try {
      await onVisitCompleted(updated.guestId, updated.restaurantId, updated.id);
    } catch {
      // Non-critical — don't fail reservation update if loyalty processing fails
    }

    // Engagement: schedule post-visit thank-you and review request
    try {
      await scheduleThankYou(updated.guestId, updated.restaurantId, updated.id);
      await scheduleReviewRequest(updated.guestId, updated.restaurantId, updated.id);
    } catch {
      // Non-critical — don't fail reservation update if engagement scheduling fails
    }
  }

  const [guestRow] = await db
    .select()
    .from(guestsTable)
    .where(eq(guestsTable.id, updated.guestId))
    .limit(1);

  return toDomainReservation(updated, guestRow);
}

export async function cancelReservation(
  id: string,
  reason?: string,
): Promise<{
  reservation: DomainReservation;
  waitlistMatch?: { id: string; guestName: string; guestPhone: string };
} | null> {
  // Get the reservation before cancelling so we have slot details
  const existing = await getReservationRowById(id);
  if (!existing) return null;

  const [updated] = await db
    .update(reservations)
    .set({
      status: "cancelled",
      cancellationReason: reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(reservations.id, id))
    .returning();

  if (!updated) return null;

  // Remove scheduled reminder
  try { await reminderQueue.remove(`reminder-${id}`); } catch { /* ignore */ }

  const [guestRow] = await db
    .select()
    .from(guestsTable)
    .where(eq(guestsTable.id, updated.guestId))
    .limit(1);

  const reservation = toDomainReservation(updated, guestRow);

  // Auto-match waitlist: find guests waiting for this slot
  let waitlistMatch: { id: string; guestName: string; guestPhone: string } | undefined;
  try {
    const { matchWaitlist, offerSlot } = await import("./waitlist.service.js");
    const freedTimeEnd = updated.timeEnd ?? computeReservationEnd(updated.timeStart);
    const matches = await matchWaitlist(
      updated.restaurantId,
      updated.date,
      updated.timeStart,
      freedTimeEnd,
      updated.partySize,
    );
    if (matches.length > 0) {
      const firstMatch = matches[0]!;
      // Auto-offer to the first match
      await offerSlot(firstMatch.id);
      waitlistMatch = {
        id: firstMatch.id,
        guestName: firstMatch.guestName,
        guestPhone: firstMatch.guestPhone,
      };
    }
  } catch {
    // Non-critical — don't fail cancellation if waitlist matching fails
  }

  return { reservation, waitlistMatch };
}

export async function markNoShow(id: string): Promise<DomainReservation | null> {
  const existing = await getReservationRowById(id);
  if (!existing) return null;

  const [updated] = await db
    .update(reservations)
    .set({
      status: "no_show",
      updatedAt: new Date(),
    })
    .where(eq(reservations.id, id))
    .returning();

  if (!updated) return null;

  // Increment guest noShowCount
  await db
    .update(guestsTable)
    .set({
      noShowCount: sql`${guestsTable.noShowCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(guestsTable.id, updated.guestId));

  const [guestRow] = await db
    .select()
    .from(guestsTable)
    .where(eq(guestsTable.id, updated.guestId))
    .limit(1);

  return toDomainReservation(updated, guestRow);
}
