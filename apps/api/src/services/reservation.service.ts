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
  CreateWalkInInput,
  Reservation as DomainReservation,
} from "@openseat/domain";
import { findOrCreateGuest, toDomainGuest, refreshVisitAutoTags, type GuestRow } from "./guest.service.js";
import {
  getActiveTablesForRestaurant,
  pickBestTablesForParty,
  type TableRow,
} from "./table.service.js";
import { onVisitCompleted } from "./loyalty.service.js";
import { autoProgressVisitCountChallenges, updateStreak } from "./challenge.service.js";

export type ReservationRow = InferSelectModel<typeof reservations>;

type ReservationHttpError = Error & { statusCode: number };

// ── Status transition rules ────────────────────────────

const VALID_TRANSITIONS: Partial<Record<ReservationRow["status"], ReservationRow["status"][]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["completed", "cancelled"],
};

function makeReservationError(message: string, statusCode = 400): ReservationHttpError {
  const err = new Error(message) as ReservationHttpError;
  err.statusCode = statusCode;
  return err;
}

/** Throws a 409 error if the transition is not allowed. */
export function assertValidTransition(
  from: ReservationRow["status"],
  to: ReservationRow["status"],
): void {
  if (from === to) return;
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw makeReservationError(
      `Cannot transition reservation from "${from}" to "${to}"`,
      409,
    );
  }
}

// ── Constants ──────────────────────────────────────────

const ACTIVE_RESERVATION_STATUSES: ReservationRow["status"][] = [
  "pending",
  "confirmed",
  "seated",
];

const DEFAULT_RESERVATION_DURATION_MINUTES = 120;
const SLOT_INTERVAL_MINUTES = 30;

// ── Helpers ────────────────────────────────────────────

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

function getJerusalemTodayString(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to compute Jerusalem date");
  }

  return `${year}-${month}-${day}`;
}

type RestaurantRow = InferSelectModel<typeof restaurants>;
type OperatingHoursWindow = {
  dayKey: string;
  open: string;
  close: string;
  openMinutes: number;
  closeMinutes: number;
};

async function getRestaurantOrThrow(restaurantId: string): Promise<RestaurantRow> {
  const [restaurant] = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);

  if (!restaurant) {
    throw makeReservationError("Restaurant not found", 404);
  }

  return restaurant;
}

function getOperatingHoursWindow(restaurant: RestaurantRow, date: string): OperatingHoursWindow {
  const dayKey = getDayKey(date);
  const operatingHours = (restaurant.operatingHours as unknown as Record<
    string,
    { open: string; close: string } | null
  >) ?? {};
  const dayHours = operatingHours[dayKey];

  if (!dayHours) {
    throw makeReservationError(
      `Restaurant is closed on ${dayKey}. No operating hours defined for this day.`,
      400,
    );
  }

  const openMinutes = timeStringToMinutes(dayHours.open);
  let closeMinutes = timeStringToMinutes(dayHours.close);
  if (closeMinutes <= openMinutes) {
    closeMinutes += 24 * 60;
  }

  return {
    dayKey,
    open: dayHours.open,
    close: dayHours.close,
    openMinutes,
    closeMinutes,
  };
}

function assertReservationDateIsNotPast(date: string): void {
  if (date < getJerusalemTodayString()) {
    throw makeReservationError("Cannot create a reservation for a date in the past", 400);
  }
}

function assertReservationWithinOperatingHours(timeStart: string, window: OperatingHoursWindow): void {
  let requestedStartMinutes = timeStringToMinutes(timeStart);
  if (requestedStartMinutes < window.openMinutes) {
    requestedStartMinutes += 24 * 60;
  }

  const requestedEndMinutes = requestedStartMinutes + DEFAULT_RESERVATION_DURATION_MINUTES;

  if (requestedStartMinutes < window.openMinutes || requestedEndMinutes > window.closeMinutes) {
    throw makeReservationError(
      `Requested time ${timeStart} is outside operating hours (${window.open}–${window.close}) for ${window.dayKey}.`,
      400,
    );
  }
}

function buildLifecycleTimestamps(
  existing: Pick<ReservationRow, "status" | "confirmedAt" | "seatedAt" | "completedAt" | "cancelledAt" | "noShowAt">,
  nextStatus: ReservationRow["status"],
  now: Date,
) {
  assertValidTransition(existing.status, nextStatus);

  return {
    status: nextStatus,
    confirmedAt: (nextStatus === "confirmed" && !existing.confirmedAt) ? now : existing.confirmedAt,
    seatedAt: (nextStatus === "seated" && !existing.seatedAt) ? now : existing.seatedAt,
    completedAt: (nextStatus === "completed" && !existing.completedAt) ? now : existing.completedAt,
    cancelledAt: (nextStatus === "cancelled" && !existing.cancelledAt) ? now : existing.cancelledAt,
    noShowAt: (nextStatus === "no_show" && !existing.noShowAt) ? now : existing.noShowAt,
  };
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
    confirmedAt: row.confirmedAt?.toISOString() ?? undefined,
    seatedAt: row.seatedAt?.toISOString() ?? undefined,
    completedAt: row.completedAt?.toISOString() ?? undefined,
    cancelledAt: row.cancelledAt?.toISOString() ?? undefined,
    noShowAt: row.noShowAt?.toISOString() ?? undefined,
  };
}

// ── Public service functions ───────────────────────────

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
  assertReservationDateIsNotPast(input.date);

  const restaurant = await getRestaurantOrThrow(input.restaurantId);
  const operatingWindow = getOperatingHoursWindow(restaurant, input.date);
  assertReservationWithinOperatingHours(input.timeStart, operatingWindow);

  const guestSource =
    input.source === "phone" || !input.source ? "web" as const : input.source;

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
    throw makeReservationError("No tables available for requested time", 409);
  }

  const tableIds = pickBestTablesForParty(availableTables, input.partySize);
  if (!tableIds) {
    throw makeReservationError("No suitable table combination found for party size", 409);
  }

  const timeEnd = computeReservationEnd(input.timeStart);
  const now = new Date();

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
      confirmedAt: now,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to create reservation");
  }

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

export async function createWalkIn(
  input: CreateWalkInInput,
): Promise<DomainReservation> {
  assertReservationDateIsNotPast(input.date);

  const restaurant = await getRestaurantOrThrow(input.restaurantId);
  const operatingWindow = getOperatingHoursWindow(restaurant, input.date);
  assertReservationWithinOperatingHours(input.timeStart, operatingWindow);

  const guestRow = await findOrCreateGuest({
    restaurantId: input.restaurantId,
    name: input.guestName,
    phone: input.guestPhone,
    email: undefined,
    source: "walk_in",
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
    throw makeReservationError("No tables available for requested time", 409);
  }

  const tableIds = pickBestTablesForParty(availableTables, input.partySize);
  if (!tableIds) {
    throw makeReservationError("No suitable table combination found for party size", 409);
  }

  const timeEnd = computeReservationEnd(input.timeStart);
  const now = new Date();
  const status: ReservationRow["status"] = input.seatImmediately ? "seated" : "confirmed";

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
      status,
      source: "walk_in",
      notes: input.notes,
      confirmedAt: now,
      seatedAt: input.seatImmediately ? now : undefined,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to create walk-in reservation");
  }

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
    // Non-critical — don't fail walk-in creation if reminder scheduling fails
  }

  return toDomainReservation(inserted, guestRow);
}

export async function listReservations(params: {
  restaurantId?: string;
  date?: string;
}): Promise<DomainReservation[]> {
  const { restaurantId, date } = params;

  const conditions: ReturnType<typeof eq>[] = [];

  if (restaurantId) {
    conditions.push(eq(reservations.restaurantId, restaurantId));
  }

  if (date) {
    conditions.push(eq(reservations.date, date));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      reservation: reservations,
      guest: guestsTable,
    })
    .from(reservations)
    .leftJoin(guestsTable as any, eq(reservations.guestId, guestsTable.id))
    .where(whereClause)
    .orderBy(reservations.date, reservations.timeStart) as Array<{
      reservation: ReservationRow;
      guest: GuestRow | null;
    }>;

  return rows.map((row) =>
    toDomainReservation(row.reservation, row.guest ?? undefined),
  );
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

  const newStatus = input.status ?? existing.status;

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

  const now = new Date();
  const lifecycle = buildLifecycleTimestamps(existing, newStatus, now);

  const [updated] = await db
    .update(reservations)
    .set({
      date: newDate,
      timeStart: newTimeStart,
      timeEnd,
      partySize: newPartySize,
      tableIds: newTableIds,
      ...lifecycle,
      notes: input.notes ?? existing.notes,
      cancellationReason:
        input.cancellationReason !== undefined
          ? input.cancellationReason
          : existing.cancellationReason,
      updatedAt: now,
    })
    .where(eq(reservations.id, id))
    .returning();

  if (!updated) return null;

  if (newStatus === "no_show" && existing.status !== "no_show") {
    await db
      .update(guestsTable)
      .set({
        noShowCount: sql`${guestsTable.noShowCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(guestsTable.id, updated.guestId));
  }

  // Increment visitCount/loyalty only on entry to completed
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

    try {
      await refreshVisitAutoTags(updated.guestId);
    } catch (error) {
      console.error("reservation completion: failed to refresh visit auto tags", {
        reservationId: updated.id,
        guestId: updated.guestId,
        restaurantId: updated.restaurantId,
        error,
      });
    }

    try {
      await onVisitCompleted(updated.guestId, updated.restaurantId, updated.id);
    } catch (error) {
      console.error("reservation completion: failed to award loyalty updates", {
        reservationId: updated.id,
        guestId: updated.guestId,
        restaurantId: updated.restaurantId,
        error,
      });
    }

    try {
      await updateStreak(updated.guestId, updated.restaurantId);
    } catch (error) {
      console.error("reservation completion: failed to update streak", {
        reservationId: updated.id,
        guestId: updated.guestId,
        restaurantId: updated.restaurantId,
        error,
      });
    }

    try {
      await autoProgressVisitCountChallenges(updated.guestId, updated.restaurantId);
    } catch (error) {
      console.error("reservation completion: failed to progress visit_count challenges", {
        reservationId: updated.id,
        guestId: updated.guestId,
        restaurantId: updated.restaurantId,
        error,
      });
    }

    try {
      await scheduleThankYou(updated.guestId, updated.restaurantId, updated.id);
      await scheduleReviewRequest(updated.guestId, updated.restaurantId, updated.id);
    } catch (error) {
      console.error("reservation completion: failed to schedule engagement jobs", {
        reservationId: updated.id,
        guestId: updated.guestId,
        restaurantId: updated.restaurantId,
        error,
      });
    }
  }

  const guestResult = await db
    .select()
    .from(guestsTable as any)
    .where(eq(guestsTable.id, updated.guestId))
    .limit(1) as GuestRow[];
  const [guestRow] = guestResult;

  return toDomainReservation(updated, guestRow);
}

export async function cancelReservation(
  id: string,
  reason?: string,
): Promise<{
  reservation: DomainReservation;
  waitlistMatch?: { id: string; guestName: string; guestPhone: string };
} | null> {
  const existing = await getReservationRowById(id);
  if (!existing) return null;

  const now = new Date();
  const lifecycle = buildLifecycleTimestamps(existing, "cancelled", now);

  const [updated] = await db
    .update(reservations)
    .set({
      ...lifecycle,
      cancellationReason: reason ?? null,
      updatedAt: now,
    })
    .where(eq(reservations.id, id))
    .returning();

  if (!updated) return null;

  try { await reminderQueue.remove(`reminder-${id}`); } catch { /* ignore */ }

  const guestResult = await db
    .select()
    .from(guestsTable as any)
    .where(eq(guestsTable.id, updated.guestId))
    .limit(1) as GuestRow[];
  const [guestRow] = guestResult;

  const reservation = toDomainReservation(updated, guestRow);

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
      await offerSlot(firstMatch.id);
      waitlistMatch = {
        id: firstMatch.id,
        guestName: firstMatch.guestName,
        guestPhone: firstMatch.guestPhone,
      };
    }
  } catch {
    // Non-critical
  }

  return { reservation, waitlistMatch };
}

export async function markNoShow(id: string): Promise<DomainReservation | null> {
  const existing = await getReservationRowById(id);
  if (!existing) return null;

  const now = new Date();
  const lifecycle = buildLifecycleTimestamps(existing, "no_show", now);

  const [updated] = await db
    .update(reservations)
    .set({
      ...lifecycle,
      updatedAt: now,
    })
    .where(eq(reservations.id, id))
    .returning();

  if (!updated) return null;

  // Increment noShowCount only on entry to no_show
  if (existing.status !== "no_show") {
    await db
      .update(guestsTable)
      .set({
        noShowCount: sql`${guestsTable.noShowCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(guestsTable.id, updated.guestId));
  }

  const guestResult = await db
    .select()
    .from(guestsTable as any)
    .where(eq(guestsTable.id, updated.guestId))
    .limit(1) as GuestRow[];
  const [guestRow] = guestResult;

  return toDomainReservation(updated, guestRow);
}
