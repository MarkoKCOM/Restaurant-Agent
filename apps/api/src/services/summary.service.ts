import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { reservations, guests as guestsTable } from "../db/schema.js";
import type { InferSelectModel } from "drizzle-orm";

type ReservationRow = InferSelectModel<typeof reservations>;
type GuestRow = InferSelectModel<typeof guestsTable>;

export interface DailySummary {
  date: string;
  totalReservations: number;
  totalCovers: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  topGuests: Array<{ name: string; visits: number }>;
  occupancyPeak: { slot: string; covers: number } | null;
}

export async function getDailySummary(
  restaurantId: string,
  date: string,
): Promise<DailySummary> {
  const reservationRows = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.restaurantId, restaurantId),
        eq(reservations.date, date),
      ),
    )
    .orderBy(reservations.timeStart);

  const guestRows = await db
    .select()
    .from(guestsTable)
    .where(eq(guestsTable.restaurantId, restaurantId));
  const guestMap = new Map(guestRows.map((guest) => [guest.id, guest]));

  const dayReservations = reservationRows.map((reservation) => ({
    reservation,
    guest: guestMap.get(reservation.guestId) ?? null,
  }));

  const activeStatuses = ["pending", "confirmed", "seated", "completed"];
  const activeReservations = dayReservations.filter(({ reservation }) =>
    activeStatuses.includes(reservation.status),
  );

  const totalReservations = activeReservations.length;
  const totalCovers = activeReservations.reduce(
    (sum, { reservation }) => sum + reservation.partySize,
    0,
  );

  const completedCount = dayReservations.filter(
    ({ reservation }) => reservation.status === "completed",
  ).length;
  const cancelledCount = dayReservations.filter(
    ({ reservation }) => reservation.status === "cancelled",
  ).length;
  const noShowCount = dayReservations.filter(
    ({ reservation }) => reservation.status === "no_show",
  ).length;

  // Top guests: guests with most visits who have reservations today
  const guestVisitMap = new Map<string, { name: string; visits: number }>();
  for (const { reservation, guest } of dayReservations) {
    if (!guest) continue;
    if (!activeStatuses.includes(reservation.status)) continue;
    const existing = guestVisitMap.get(guest.id);
    if (!existing || guest.visitCount > existing.visits) {
      guestVisitMap.set(guest.id, { name: guest.name, visits: guest.visitCount });
    }
  }

  const topGuests = Array.from(guestVisitMap.values())
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5);

  // Occupancy peak: find the 30-min slot with the most covers
  const slotCovers = new Map<string, number>();
  for (const { reservation } of activeReservations) {
    const [startH, startM] = reservation.timeStart.split(":").map(Number);
    const resStart = startH * 60 + startM;
    const resEndStr = reservation.timeEnd;
    let resEnd: number;
    if (resEndStr) {
      const [endH, endM] = resEndStr.split(":").map(Number);
      resEnd = endH * 60 + endM;
    } else {
      resEnd = resStart + 120;
    }

    // Iterate 30-min slots that this reservation covers
    const slotStart = Math.floor(resStart / 30) * 30;
    for (let t = slotStart; t < resEnd; t += 30) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      const slotKey = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      slotCovers.set(slotKey, (slotCovers.get(slotKey) ?? 0) + reservation.partySize);
    }
  }

  let occupancyPeak: { slot: string; covers: number } | null = null;
  for (const [slot, covers] of slotCovers) {
    if (!occupancyPeak || covers > occupancyPeak.covers) {
      occupancyPeak = { slot, covers };
    }
  }

  return {
    date,
    totalReservations,
    totalCovers,
    completedCount,
    cancelledCount,
    noShowCount,
    topGuests,
    occupancyPeak,
  };
}
