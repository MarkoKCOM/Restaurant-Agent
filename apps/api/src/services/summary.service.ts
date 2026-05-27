import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { reservations, guests as guestsTable, restaurants, waitlist } from "../db/schema.js";
import type { InferSelectModel } from "drizzle-orm";

type ReservationRow = InferSelectModel<typeof reservations>;
type GuestRow = InferSelectModel<typeof guestsTable>;

const ACTIVE_RESERVATION_STATUSES = ["pending", "confirmed", "seated", "completed"];

function toDateKey(date: Date, timeZone = "UTC"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/\s+/g, "");
  return normalized.length <= 4 ? "****" : `${normalized.slice(0, 3)}****${normalized.slice(-2)}`;
}

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

export interface MorningSummary {
  restaurantId: string;
  restaurantName: string;
  timezone: string;
  locale: string;
  generatedAt: string;
  summaryDate: string;
  yesterdayDate: string;
  ownerWhatsappConfigured: boolean;
  ownerRecipientMasked: string | null;
  yesterday: DailySummary;
  today: DailySummary & {
    pendingCount: number;
    confirmedCount: number;
    seatedCount: number;
  };
  notableGuests: Array<{
    guestId: string;
    name: string;
    time: string;
    partySize: number;
    tier: string | null;
    visits: number;
    tags: string[];
    reasons: string[];
  }>;
  alerts: Array<{
    code: string;
    severity: "info" | "warning" | "critical";
    message: string;
  }>;
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

  const activeReservations = dayReservations.filter(({ reservation }) =>
    ACTIVE_RESERVATION_STATUSES.includes(reservation.status),
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
    if (!ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) continue;
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

function notableReasons(guest: GuestRow): string[] {
  const reasons: string[] = [];
  const preferences = asRecord(guest.preferences);
  const tags = Array.isArray(guest.tags) ? guest.tags : [];

  if (guest.tier === "gold") reasons.push("gold tier");
  else if (guest.tier === "silver") reasons.push("silver tier");
  if (guest.visitCount >= 10) reasons.push("regular");
  else if (guest.visitCount >= 5) reasons.push("returning guest");
  if (guest.noShowCount >= 2) reasons.push("repeat no-show risk");
  for (const tag of tags) {
    if (["vip", "owner_friend", "house_comp", "celebration", "birthday"].includes(tag)) {
      reasons.push(tag.replaceAll("_", " "));
    }
  }
  if (typeof preferences.occasion === "string" && preferences.occasion.trim()) {
    reasons.push(preferences.occasion.trim());
  }
  if (typeof preferences.seatingPreference === "string" && preferences.seatingPreference.trim()) {
    reasons.push(preferences.seatingPreference.trim());
  }

  return [...new Set(reasons)].slice(0, 4);
}

function formatAlertMessage(alert: MorningSummary["alerts"][number], locale: string): string {
  if (locale.startsWith("he")) {
    if (alert.code === "OWNER_WHATSAPP_MISSING") return "לא מוגדר מספר וואטסאפ לבעלים.";
    if (alert.code === "YESTERDAY_NO_SHOWS") return alert.message.replace("No-shows yesterday", "אי-הגעות אתמול");
    if (alert.code === "YESTERDAY_CANCELLATIONS") return alert.message.replace("Cancellations yesterday", "ביטולים אתמול");
    if (alert.code === "WAITLIST_TODAY") return alert.message.replace("Waiting parties today", "רשימת המתנה להיום");
  }
  return alert.message;
}

export async function getMorningSummary(params: {
  restaurantId: string;
  date?: string;
  now?: Date;
}): Promise<MorningSummary> {
  const restaurant = await db.query.restaurants.findFirst({
    where: eq(restaurants.id, params.restaurantId),
  });
  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  const timezone = restaurant.timezone || "Asia/Jerusalem";
  const summaryDate = params.date ?? toDateKey(params.now ?? new Date(), timezone);
  const yesterdayDate = addDays(summaryDate, -1);
  const [yesterday, today, todayReservations, guestRows, waitlistRows] = await Promise.all([
    getDailySummary(params.restaurantId, yesterdayDate),
    getDailySummary(params.restaurantId, summaryDate),
    db.select().from(reservations).where(and(
      eq(reservations.restaurantId, params.restaurantId),
      eq(reservations.date, summaryDate),
    )),
    db.select().from(guestsTable).where(eq(guestsTable.restaurantId, params.restaurantId)),
    db.select().from(waitlist).where(and(
      eq(waitlist.restaurantId, params.restaurantId),
      eq(waitlist.date, summaryDate),
      eq(waitlist.status, "waiting"),
    )),
  ]);
  const guestsById = new Map(guestRows.map((guest) => [guest.id, guest]));
  const activeToday = todayReservations
    .filter((reservation) => ACTIVE_RESERVATION_STATUSES.includes(reservation.status))
    .sort((left, right) => left.timeStart.localeCompare(right.timeStart));

  const notableGuests = activeToday
    .map((reservation) => {
      const guest = guestsById.get(reservation.guestId);
      if (!guest) return null;
      const reasons = notableReasons(guest);
      return {
        guestId: guest.id,
        name: guest.name,
        time: reservation.timeStart.slice(0, 5),
        partySize: reservation.partySize,
        tier: guest.tier,
        visits: guest.visitCount,
        tags: Array.isArray(guest.tags) ? guest.tags : [],
        reasons,
      };
    })
    .filter((guest): guest is NonNullable<typeof guest> => guest !== null)
    .sort((left, right) => right.reasons.length - left.reasons.length || right.visits - left.visits)
    .slice(0, 5);

  const alerts: MorningSummary["alerts"] = [];
  if (!restaurant.ownerWhatsapp) {
    alerts.push({
      code: "OWNER_WHATSAPP_MISSING",
      severity: "warning",
      message: "Owner WhatsApp number is not configured.",
    });
  }
  if (yesterday.noShowCount > 0) {
    alerts.push({
      code: "YESTERDAY_NO_SHOWS",
      severity: yesterday.noShowCount >= 3 ? "critical" : "warning",
      message: `No-shows yesterday: ${yesterday.noShowCount}`,
    });
  }
  if (yesterday.cancelledCount > 0) {
    alerts.push({
      code: "YESTERDAY_CANCELLATIONS",
      severity: "info",
      message: `Cancellations yesterday: ${yesterday.cancelledCount}`,
    });
  }
  if (waitlistRows.length > 0) {
    alerts.push({
      code: "WAITLIST_TODAY",
      severity: "info",
      message: `Waiting parties today: ${waitlistRows.length}`,
    });
  }

  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    timezone,
    locale: restaurant.locale || "he",
    generatedAt: new Date().toISOString(),
    summaryDate,
    yesterdayDate,
    ownerWhatsappConfigured: Boolean(restaurant.ownerWhatsapp),
    ownerRecipientMasked: maskPhone(restaurant.ownerWhatsapp ?? restaurant.ownerPhone),
    yesterday,
    today: {
      ...today,
      pendingCount: todayReservations.filter((reservation) => reservation.status === "pending").length,
      confirmedCount: todayReservations.filter((reservation) => reservation.status === "confirmed").length,
      seatedCount: todayReservations.filter((reservation) => reservation.status === "seated").length,
    },
    notableGuests,
    alerts,
  };
}

export function formatMorningSummaryMessage(summary: MorningSummary): string {
  const isHebrew = summary.locale.startsWith("he");
  const notable = summary.notableGuests.length > 0
    ? summary.notableGuests
      .map((guest) => {
        const reasons = guest.reasons.length > 0 ? ` (${guest.reasons.join(", ")})` : "";
        return `• ${guest.time} ${guest.name}, ${guest.partySize} guests${reasons}`;
      })
      .join("\n")
    : (isHebrew ? "אין אורחים מיוחדים להיום." : "No notable guests today.");
  const alerts = summary.alerts.length > 0
    ? summary.alerts.map((alert) => `• ${formatAlertMessage(alert, summary.locale)}`).join("\n")
    : (isHebrew ? "אין התראות כרגע." : "No alerts right now.");

  if (isHebrew) {
    return [
      `בוקר טוב ${summary.restaurantName}`,
      `סיכום ${summary.summaryDate}`,
      `אתמול: ${formatNumber(summary.yesterday.totalCovers)} סועדים, ${formatNumber(summary.yesterday.completedCount)} הושלמו, ${formatNumber(summary.yesterday.cancelledCount)} ביטולים, ${formatNumber(summary.yesterday.noShowCount)} אי-הגעות.`,
      `היום: ${formatNumber(summary.today.totalReservations)} הזמנות, ${formatNumber(summary.today.totalCovers)} סועדים. שיא צפוי: ${summary.today.occupancyPeak ? `${summary.today.occupancyPeak.slot} עם ${summary.today.occupancyPeak.covers} סועדים` : "אין עדיין"}.`,
      "אורחים חשובים:",
      notable,
      "התראות:",
      alerts,
    ].join("\n");
  }

  return [
    `Good morning ${summary.restaurantName}`,
    `Summary for ${summary.summaryDate}`,
    `Yesterday: ${formatNumber(summary.yesterday.totalCovers)} covers, ${formatNumber(summary.yesterday.completedCount)} completed, ${formatNumber(summary.yesterday.cancelledCount)} cancellations, ${formatNumber(summary.yesterday.noShowCount)} no-shows.`,
    `Today: ${formatNumber(summary.today.totalReservations)} bookings, ${formatNumber(summary.today.totalCovers)} covers. Expected peak: ${summary.today.occupancyPeak ? `${summary.today.occupancyPeak.slot} with ${summary.today.occupancyPeak.covers} covers` : "none yet"}.`,
    "Notable guests:",
    notable,
    "Alerts:",
    alerts,
  ].join("\n");
}
