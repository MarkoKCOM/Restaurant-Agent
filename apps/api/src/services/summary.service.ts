import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { reservations, guests as guestsTable } from "../db/schema.js";

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
  const dayReservations = await db
    .select({ reservation: reservations, guest: guestsTable })
    .from(reservations)
    .leftJoin(guestsTable as any, eq(guestsTable.id, reservations.guestId))
    .where(
      and(
        eq(reservations.restaurantId, restaurantId),
        eq(reservations.date, date),
      ),
    )
    .orderBy(reservations.timeStart);

  const activeStatuses = ["pending", "confirmed", "seated", "completed"];
  const activeReservations = dayReservations.filter((r) =>
    activeStatuses.includes(r.reservation.status),
  );

  const totalReservations = activeReservations.length;
  const totalCovers = activeReservations.reduce(
    (sum, r) => sum + r.reservation.partySize,
    0,
  );

  const completedCount = dayReservations.filter(
    (r) => r.reservation.status === "completed",
  ).length;
  const cancelledCount = dayReservations.filter(
    (r) => r.reservation.status === "cancelled",
  ).length;
  const noShowCount = dayReservations.filter(
    (r) => r.reservation.status === "no_show",
  ).length;

  // Top guests: guests with most visits (from guest record) who have reservations today
  const guestVisitMap = new Map<string, { name: string; visits: number }>();
  for (const row of dayReservations) {
    if (!row.guest) continue;
    if (!activeStatuses.includes(row.reservation.status)) continue;
    const existing = guestVisitMap.get(row.guest.id);
    if (!existing || row.guest.visitCount > existing.visits) {
      guestVisitMap.set(row.guest.id, {
        name: row.guest.name,
        visits: row.guest.visitCount,
      });
    }
  }
  const topGuests = Array.from(guestVisitMap.values())
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5);

  // Occupancy peak: find the 30-min slot with the most covers
  const slotCovers = new Map<string, number>();
  for (const row of activeReservations) {
    const res = row.reservation;
    const [startH, startM] = res.timeStart.split(":").map(Number);
    const resStart = startH * 60 + startM;
    const resEndStr = res.timeEnd;
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
      slotCovers.set(slotKey, (slotCovers.get(slotKey) ?? 0) + res.partySize);
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
