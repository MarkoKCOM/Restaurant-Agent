import { findOrCreateGuest, type GuestRow } from "./guest.service.js";
import { waitlistRepository } from "../repositories/waitlist.repository.js";
import { guestRepository } from "../repositories/guest.repository.js";

export type { WaitlistRow } from "../repositories/waitlist.repository.js";
import type { WaitlistRow } from "../repositories/waitlist.repository.js";

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

async function getGuestMapForRestaurant(restaurantId: string): Promise<Map<string, GuestRow>> {
  const guestRows = await guestRepository.listByRestaurant(restaurantId);
  return new Map(guestRows.map((guest) => [guest.id, guest]));
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

  const inserted = await waitlistRepository.insert({
    restaurantId: data.restaurantId,
    guestId: guestRow.id,
    date: data.date,
    preferredTimeStart: data.preferredTimeStart,
    preferredTimeEnd: data.preferredTimeEnd,
    partySize: data.partySize,
    status: "waiting",
  });

  if (!inserted) {
    throw new Error("Failed to add to waitlist");
  }

  return toWaitlistEntry(inserted, guestRow);
}

export async function listWaitlist(
  restaurantId: string,
  date?: string,
): Promise<WaitlistEntry[]> {
  const rows = await waitlistRepository.listByRestaurant(restaurantId, date);

  const guestMap = await getGuestMapForRestaurant(restaurantId);

  return rows
    .map((row) => {
      const guest = guestMap.get(row.guestId);
      return guest ? toWaitlistEntry(row, guest) : null;
    })
    .filter((row): row is WaitlistEntry => row !== null);
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
  const rows = await waitlistRepository.findWaitingForDay(restaurantId, date);

  const guestMap = await getGuestMapForRestaurant(restaurantId);

  // Filter: time overlap + party size fits
  return rows
    .filter((row) => {
      const prefStart = timeStringToMinutes(row.preferredTimeStart);
      const prefEnd = timeStringToMinutes(row.preferredTimeEnd);
      return (
        rangesOverlap(prefStart, prefEnd, freedStartMin, freedEndMin) &&
        row.partySize <= freedPartySize
      );
    })
    .map((row) => {
      const guest = guestMap.get(row.guestId);
      return guest ? toWaitlistEntry(row, guest) : null;
    })
    .filter((row): row is WaitlistEntry => row !== null);
}

export async function offerSlot(waitlistId: string): Promise<WaitlistEntry | null> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

  const updated = await waitlistRepository.updateById(waitlistId, {
    status: "offered",
    offeredAt: now,
    expiresAt,
  });

  if (!updated) return null;

  const guest = await guestRepository.findById(updated.guestId);

  return guest ? toWaitlistEntry(updated, guest) : null;
}

export async function acceptOffer(waitlistId: string): Promise<{
  waitlistEntry: WaitlistEntry;
  reservationId: string;
} | null> {
  // Get the waitlist entry
  const entry = await waitlistRepository.findById(waitlistId);

  if (!entry || entry.status !== "offered") return null;

  const guest = await guestRepository.findById(entry.guestId);

  if (!guest) return null;

  // Create reservation from waitlist entry (dynamic import to avoid circular dependency)
  const { createReservation } = await import("./reservation.service.js");
  const reservation = await createReservation({
    restaurantId: entry.restaurantId,
    guestName: guest.name,
    guestPhone: guest.phone,
    date: entry.date,
    timeStart: entry.preferredTimeStart,
    partySize: entry.partySize,
    source: "phone",
    notes: "נוצר מרשימת המתנה",
  });

  // Update waitlist status
  const updated = await waitlistRepository.updateById(waitlistId, { status: "accepted" });

  if (!updated) return null;

  return {
    waitlistEntry: toWaitlistEntry(updated, guest),
    reservationId: reservation.id,
  };
}

export async function expireStaleOffers(): Promise<number> {
  return waitlistRepository.expireOffersBefore(new Date());
}

export async function cancelWaitlistEntry(waitlistId: string): Promise<WaitlistEntry | null> {
  const updated = await waitlistRepository.updateById(waitlistId, { status: "expired" });

  if (!updated) return null;

  const guest = await guestRepository.findById(updated.guestId);

  return guest ? toWaitlistEntry(updated, guest) : null;
}

// ── Aliases matching task spec ────────────────────────

/** Alias for cancelWaitlistEntry */
export const removeFromWaitlist = cancelWaitlistEntry;

/** Alias for listWaitlist */
export const getWaitlistByRestaurant = listWaitlist;

/**
 * Auto-match on cancellation — simplified wrapper around matchWaitlist.
 * Finds the best waitlist match by party size + timestamp for a freed slot.
 * Called externally; the full auto-offer flow lives in reservation.service.cancelReservation.
 */
export async function autoMatchOnCancellation(
  restaurantId: string,
  date: string,
  freedTableCapacity: number,
  freedTimeStart?: string,
  freedTimeEnd?: string,
): Promise<WaitlistEntry | null> {
  const timeStart = freedTimeStart ?? "00:00";
  const timeEnd = freedTimeEnd ?? "23:59";
  const matches = await matchWaitlist(restaurantId, date, timeStart, timeEnd, freedTableCapacity);
  if (matches.length === 0) return null;
  // Auto-offer the best (first) match
  const best = matches[0]!;
  const offered = await offerSlot(best.id);
  return offered ? best : null;
}
