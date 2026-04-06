import { and, eq, lte, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { waitlist, guests as guestsTable, reservations } from "../db/schema.js";
import { findOrCreateGuest, type GuestRow } from "./guest.service.js";
import { createReservation } from "./reservation.service.js";

export type WaitlistRow = InferSelectModel<typeof waitlist>;

export interface WaitlistEntry {
  id: string;
  restaurantId: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  date: string;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  partySize: number;
  status: string;
  offeredAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

function toWaitlistEntry(row: WaitlistRow, guest: GuestRow): WaitlistEntry {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    guestId: row.guestId,
    guestName: guest.name,
    guestPhone: guest.phone,
    date: row.date,
    preferredTimeStart: row.preferredTimeStart,
    preferredTimeEnd: row.preferredTimeEnd,
    partySize: row.partySize,
    status: row.status,
    offeredAt: row.offeredAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export async function addToWaitlist(data: {
  restaurantId: string;
  guestName: string;
  guestPhone: string;
  date: string;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  partySize: number;
}): Promise<WaitlistEntry> {
  const guestRow = await findOrCreateGuest({
    restaurantId: data.restaurantId,
    name: data.guestName,
    phone: data.guestPhone,
    email: undefined,
    language: "he",
    source: "web",
  });

  const [inserted] = await db
    .insert(waitlist)
    .values({
      restaurantId: data.restaurantId,
      guestId: guestRow.id,
      date: data.date,
      preferredTimeStart: data.preferredTimeStart,
      preferredTimeEnd: data.preferredTimeEnd,
      partySize: data.partySize,
      status: "waiting",
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to add to waitlist");
  }

  return toWaitlistEntry(inserted, guestRow);
}

async function resolveGuest(guestId: string): Promise<GuestRow> {
  const [guest] = await db
    .select()
    .from(guestsTable)
    .where(eq(guestsTable.id, guestId))
    .limit(1);
  return guest;
}

export async function listWaitlist(
  restaurantId: string,
  date?: string,
): Promise<WaitlistEntry[]> {
  const conditions = [eq(waitlist.restaurantId, restaurantId)];
  if (date) {
    conditions.push(eq(waitlist.date, date));
  }

  const rows = await db
    .select()
    .from(waitlist)
    .where(and(...conditions))
    .orderBy(waitlist.createdAt);

  const entries: WaitlistEntry[] = [];
  for (const row of rows) {
    const guest = await resolveGuest(row.guestId);
    if (guest) entries.push(toWaitlistEntry(row, guest));
  }
  return entries;
}

export async function matchWaitlist(
  restaurantId: string,
  date: string,
  freedTimeStart: string,
  freedTimeEnd: string,
  freedPartySize: number,
): Promise<WaitlistEntry[]> {
  const freedStartMin = timeStringToMinutes(freedTimeStart);
  const freedEndMin = timeStringToMinutes(freedTimeEnd);

  // Get all waiting entries for this restaurant and date
  const rows = await db
    .select()
    .from(waitlist)
    .where(
      and(
        eq(waitlist.restaurantId, restaurantId),
        eq(waitlist.date, date),
        eq(waitlist.status, "waiting"),
      ),
    )
    .orderBy(waitlist.createdAt);

  // Filter: time overlap + party size fits
  const matched: WaitlistEntry[] = [];
  for (const row of rows) {
    const prefStart = timeStringToMinutes(row.preferredTimeStart);
    const prefEnd = timeStringToMinutes(row.preferredTimeEnd);
    if (rangesOverlap(prefStart, prefEnd, freedStartMin, freedEndMin) && row.partySize <= freedPartySize) {
      const guest = await resolveGuest(row.guestId);
      if (guest) matched.push(toWaitlistEntry(row, guest));
    }
  }
  return matched;
}

export async function offerSlot(waitlistId: string): Promise<WaitlistEntry | null> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

  const [updated] = await db
    .update(waitlist)
    .set({
      status: "offered",
      offeredAt: now,
      expiresAt,
    })
    .where(eq(waitlist.id, waitlistId))
    .returning();

  if (!updated) return null;

  const [guest] = await db
    .select()
    .from(guestsTable)
    .where(eq(guestsTable.id, updated.guestId))
    .limit(1);

  return guest ? toWaitlistEntry(updated, guest) : null;
}

export async function acceptOffer(waitlistId: string): Promise<{
  waitlistEntry: WaitlistEntry;
  reservationId: string;
} | null> {
  // Get the waitlist entry
  const [wlRow] = await db
    .select()
    .from(waitlist)
    .where(eq(waitlist.id, waitlistId))
    .limit(1);

  if (!wlRow || wlRow.status !== "offered") return null;

  const guest = await resolveGuest(wlRow.guestId);
  if (!guest) return null;

  // Create reservation from waitlist entry
  const reservation = await createReservation({
    restaurantId: wlRow.restaurantId,
    guestName: guest.name,
    guestPhone: guest.phone,
    date: wlRow.date,
    timeStart: wlRow.preferredTimeStart,
    partySize: wlRow.partySize,
    source: "phone",
    notes: "נוצר מרשימת המתנה",
  });

  // Update waitlist status
  const [updated] = await db
    .update(waitlist)
    .set({ status: "accepted" })
    .where(eq(waitlist.id, waitlistId))
    .returning();

  if (!updated) return null;

  return {
    waitlistEntry: toWaitlistEntry(updated, guest),
    reservationId: reservation.id,
  };
}

export async function expireStaleOffers(): Promise<number> {
  const now = new Date();
  const result = await db
    .update(waitlist)
    .set({ status: "expired" })
    .where(
      and(
        eq(waitlist.status, "offered"),
        lte(waitlist.expiresAt, now),
      ),
    )
    .returning();

  return result.length;
}

export async function cancelWaitlistEntry(waitlistId: string): Promise<WaitlistEntry | null> {
  const [updated] = await db
    .update(waitlist)
    .set({ status: "expired" })
    .where(eq(waitlist.id, waitlistId))
    .returning();

  if (!updated) return null;

  const [guest] = await db
    .select()
    .from(guestsTable)
    .where(eq(guestsTable.id, updated.guestId))
    .limit(1);

  return guest ? toWaitlistEntry(updated, guest) : null;
}
