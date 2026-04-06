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
  const dayReservations = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.restaurantId, restaurantId),
        eq(reservations.date, date),
      ),
    )
    .orderBy(reservations.timeStart);

  // Fetch guests for these reservations
  const guestIds = [...new Set(dayReservations.map((r) => r.guestId))];
  const guestRows: GuestRow[] = [];
  for (const gid of guestIds) {
    const [g] = await db.select().from(guestsTable).where(eq(guestsTable.id, gid)).limit(1);
    if (g) guestRows.push(g);
  }
  const guestMap = new Map(guestRows.map((g) => [g.id, g]));

  const activeStatuses = ["pending", "confirmed", "seated", "completed"];
  const activeReservations = dayReservations.filter((r) =>
    activeStatuses.includes(r.status),
  );

  const totalReservations = activeReservations.length;
  const totalCovers = activeReservations.reduce(
    (sum, r) => sum + r.partySize,
    0,
  );

  const completedCount = dayReservations.filter(
    (r) => r.status === "completed",
  ).length;
  const cancelledCount = dayReservations.filter(
    (r) => r.status === "cancelled",
  ).length;
  const noShowCount = dayReservations.filter(
    (r) => r.status === "no_show",
  ).length;

  // Top guests: guests with most visits who have reservations today
  const guestVisitMap = new Map<string, { name: string; visits: number }>();
  for (const res of dayReservations) {
    const guest = guestMap.get(res.guestId);
    if (!guest) continue;
    if (!activeStatuses.includes(res.status)) continue;
    const existing = guestVisitMap.get(guest.id);
    if (!existing || guest.visitCount > existing.visits) {
      guestVisitMap.set(guest.id, {
        name: guest.name,
        visits: guest.visitCount,
      });
    }
  }
  const topGuests = Array.from(guestVisitMap.values())
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5);

  // Occupancy peak: find the 30-min slot with the most covers
  const slotCovers = new Map<string, number>();
  for (const res of activeReservations) {
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
