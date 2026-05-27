import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  campaigns,
  guests,
  loyaltyTransactions,
  reservations,
  rewardClaims,
  tables,
  visitLogs,
} from "../db/schema.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 90;
const DEFAULT_CAMPAIGN_ATTRIBUTION_DAYS = 14;
const DEFAULT_CAMPAIGN_COST_PER_MESSAGE = 0.35;

type Tier = "bronze" | "silver" | "gold";

interface CampaignDeliveryRecipient {
  guestId?: string;
  status?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  repliedAt?: string;
}

interface CampaignStats {
  delivery?: {
    sent?: number;
    delivered?: number;
    read?: number;
    replied?: number;
    skipped?: number;
  };
  deliveryRecipients?: CampaignDeliveryRecipient[];
}

export interface AnalyticsPeriod {
  from: string;
  to: string;
}

export class AnalyticsInputError extends Error {
  readonly code: string;
  readonly statusCode = 400;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AnalyticsInputError";
    this.code = code;
    this.details = details;
  }
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(value: string | undefined, fallback: Date): string {
  if (!value) return toDateKey(fallback);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AnalyticsInputError("Analytics date must use YYYY-MM-DD format", "ANALYTICS_DATE_FORMAT_INVALID", { value });
  }
  return value;
}

export function resolveAnalyticsPeriod(params: {
  from?: string;
  to?: string;
  now?: Date;
}): AnalyticsPeriod {
  const now = params.now ?? new Date();
  const to = parseDateKey(params.to, now);
  const defaultFrom = new Date(`${to}T00:00:00.000Z`);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - (DEFAULT_LOOKBACK_DAYS - 1));
  const from = parseDateKey(params.from, defaultFrom);
  if (from > to) {
    throw new AnalyticsInputError(
      "Analytics from date must be before or equal to to date",
      "ANALYTICS_DATE_RANGE_INVALID",
      { from, to },
    );
  }
  return { from, to };
}

function dateKeyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: string, days: number): string {
  const date = dateKeyToUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function daysBetweenInclusive(from: string, to: string): number {
  return Math.floor((dateKeyToUtc(to).getTime() - dateKeyToUtc(from).getTime()) / DAY_MS) + 1;
}

function previousPeriod(period: AnalyticsPeriod): AnalyticsPeriod {
  const days = daysBetweenInclusive(period.from, period.to);
  return {
    from: addDays(period.from, -days),
    to: addDays(period.from, -1),
  };
}

function isDateInPeriod(value: string | null | undefined, period: AnalyticsPeriod): boolean {
  return typeof value === "string" && value >= period.from && value <= period.to;
}

function asDateKey(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return toDateKey(value);
  return value.slice(0, 10);
}

function asCampaignStats(value: unknown): CampaignStats {
  return typeof value === "object" && value !== null ? value as CampaignStats : {};
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(total: number, count: number): number {
  return count > 0 ? Number((total / count).toFixed(2)) : 0;
}

export async function getReservationAnalytics(params: {
  restaurantId: string;
  from?: string;
  to?: string;
}) {
  const period = resolveAnalyticsPeriod(params);
  const previous = previousPeriod(period);
  const [reservationRows, tableRows] = await Promise.all([
    db.select().from(reservations).where(eq(reservations.restaurantId, params.restaurantId)),
    db.select().from(tables).where(eq(tables.restaurantId, params.restaurantId)),
  ]);
  const activeSeatCapacity = tableRows
    .filter((table) => table.isActive)
    .reduce((total, table) => total + table.maxSeats, 0);

  function summarize(targetPeriod: AnalyticsPeriod) {
    const rows = reservationRows.filter((reservation) => isDateInPeriod(reservation.date, targetPeriod));
    const completed = rows.filter((reservation) => reservation.status === "completed");
    const cancelled = rows.filter((reservation) => reservation.status === "cancelled");
    const noShows = rows.filter((reservation) => reservation.status === "no_show");
    const active = rows.filter((reservation) => !["cancelled", "no_show"].includes(reservation.status));
    const covers = sum(active.map((reservation) => reservation.partySize));
    const completedCovers = sum(completed.map((reservation) => reservation.partySize));
    const occupancyBySlot = new Map<string, { reservations: number; covers: number }>();

    for (const reservation of active) {
      const slot = reservation.timeStart.slice(0, 5);
      const current = occupancyBySlot.get(slot) ?? { reservations: 0, covers: 0 };
      occupancyBySlot.set(slot, {
        reservations: current.reservations + 1,
        covers: current.covers + reservation.partySize,
      });
    }

    const slotRows = [...occupancyBySlot.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([slot, value]) => ({
        slot,
        reservations: value.reservations,
        covers: value.covers,
        occupancyRate: activeSeatCapacity > 0 ? ratio(value.covers, activeSeatCapacity) : 0,
      }));

    const peakSlot = slotRows.reduce<typeof slotRows[number] | null>((peak, slot) => {
      if (!peak || slot.covers > peak.covers) return slot;
      return peak;
    }, null);

    return {
      bookings: rows.length,
      activeBookings: active.length,
      completedBookings: completed.length,
      covers,
      completedCovers,
      cancellations: cancelled.length,
      noShows: noShows.length,
      cancellationRate: ratio(cancelled.length, rows.length),
      noShowRate: ratio(noShows.length, rows.length),
      occupancyBySlot: slotRows,
      peakSlot,
    };
  }

  return {
    restaurantId: params.restaurantId,
    generatedAt: new Date().toISOString(),
    period,
    previousPeriod: previous,
    capacity: {
      activeTables: tableRows.filter((table) => table.isActive).length,
      activeSeats: activeSeatCapacity,
    },
    current: summarize(period),
    previous: summarize(previous),
  };
}

export async function getRetentionAnalytics(params: {
  restaurantId: string;
  from?: string;
  to?: string;
  now?: Date;
}) {
  const period = resolveAnalyticsPeriod(params);
  const previous = previousPeriod(period);
  const [guestRows, visitRows] = await Promise.all([
    db.select().from(guests).where(eq(guests.restaurantId, params.restaurantId)),
    db.select().from(visitLogs).where(eq(visitLogs.restaurantId, params.restaurantId)),
  ]);

  function summarize(targetPeriod: AnalyticsPeriod) {
    const visits = visitRows.filter((visit) => isDateInPeriod(visit.date, targetPeriod));
    const visitsByGuest = new Map<string, number>();
    for (const visit of visits) {
      visitsByGuest.set(visit.guestId, (visitsByGuest.get(visit.guestId) ?? 0) + 1);
    }

    const visitingGuestIds = [...visitsByGuest.keys()];
    const guestById = new Map(guestRows.map((guest) => [guest.id, guest]));
    const newGuestIds = visitingGuestIds.filter((guestId) =>
      isDateInPeriod(guestById.get(guestId)?.firstVisitDate, targetPeriod)
    );
    const returningGuestIds = visitingGuestIds.filter((guestId) => !newGuestIds.includes(guestId));
    const frequencyBuckets = {
      one: 0,
      two: 0,
      three: 0,
      four: 0,
      fivePlus: 0,
    };
    for (const count of visitsByGuest.values()) {
      if (count <= 1) frequencyBuckets.one++;
      else if (count === 2) frequencyBuckets.two++;
      else if (count === 3) frequencyBuckets.three++;
      else if (count === 4) frequencyBuckets.four++;
      else frequencyBuckets.fivePlus++;
    }

    return {
      totalVisits: visits.length,
      uniqueGuests: visitingGuestIds.length,
      newGuests: newGuestIds.length,
      returningGuests: returningGuestIds.length,
      returningGuestRatio: ratio(returningGuestIds.length, visitingGuestIds.length),
      averageVisitsPerGuest: visitingGuestIds.length > 0 ? Number((visits.length / visitingGuestIds.length).toFixed(2)) : 0,
      visitFrequencyDistribution: frequencyBuckets,
    };
  }

  function retentionWindow(days: number, targetPeriod: AnalyticsPeriod) {
    const latestEligibleFirstVisit = addDays(targetPeriod.to, -days);
    const cohort = guestRows.filter((guest) =>
      typeof guest.firstVisitDate === "string"
      && guest.firstVisitDate >= targetPeriod.from
      && guest.firstVisitDate <= latestEligibleFirstVisit
    );
    const retained = cohort.filter((guest) => {
      const firstVisit = guest.firstVisitDate;
      if (!firstVisit) return false;
      const returnDeadline = addDays(firstVisit, days);
      return visitRows.some((visit) =>
        visit.guestId === guest.id
        && visit.date > firstVisit
        && visit.date <= returnDeadline
      );
    });

    return {
      days,
      cohortSize: cohort.length,
      retained: retained.length,
      rate: ratio(retained.length, cohort.length),
    };
  }

  return {
    restaurantId: params.restaurantId,
    generatedAt: new Date().toISOString(),
    period,
    previousPeriod: previous,
    current: summarize(period),
    previous: summarize(previous),
    retentionWindows: [30, 60, 90].map((days) => retentionWindow(days, period)),
  };
}

export async function getLoyaltyAnalytics(params: {
  restaurantId: string;
  from?: string;
  to?: string;
}) {
  const period = resolveAnalyticsPeriod(params);
  const fromDate = dateKeyToUtc(period.from);
  const toDate = new Date(`${period.to}T23:59:59.999Z`);
  const [guestRows, transactionRows, claimRows] = await Promise.all([
    db.select().from(guests).where(eq(guests.restaurantId, params.restaurantId)),
    db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.restaurantId, params.restaurantId),
          gte(loyaltyTransactions.createdAt, fromDate),
          lte(loyaltyTransactions.createdAt, toDate),
        ),
      ),
    db
      .select()
      .from(rewardClaims)
      .where(
        and(
          eq(rewardClaims.restaurantId, params.restaurantId),
          gte(rewardClaims.claimedAt, fromDate),
          lte(rewardClaims.claimedAt, toDate),
        ),
      ),
  ]);

  const pointsIssued = sum(transactionRows.filter((tx) => tx.points > 0).map((tx) => tx.points));
  const pointsRedeemed = Math.abs(sum(transactionRows.filter((tx) => tx.points < 0).map((tx) => tx.points)));
  const activeMembers = guestRows.filter((guest) => guest.visitCount > 0 || guest.pointsBalance !== 0).length;
  const tierDistribution: Record<Tier, number> = { bronze: 0, silver: 0, gold: 0 };
  for (const guest of guestRows) {
    tierDistribution[(guest.tier ?? "bronze") as Tier]++;
  }

  return {
    restaurantId: params.restaurantId,
    generatedAt: new Date().toISOString(),
    period,
    activeMembers,
    totalMembers: guestRows.length,
    pointsIssued,
    pointsRedeemed,
    netPoints: pointsIssued - pointsRedeemed,
    redemptionRate: ratio(pointsRedeemed, pointsIssued),
    rewardClaims: claimRows.length,
    rewardRedemptions: claimRows.filter((claim) => claim.status === "redeemed").length,
    programCostPoints: pointsRedeemed,
    tierDistribution,
  };
}

export async function getClvAnalytics(params: {
  restaurantId: string;
  from?: string;
  to?: string;
  topLimit?: number;
}) {
  const period = resolveAnalyticsPeriod(params);
  const topLimit = Math.max(1, Math.min(params.topLimit ?? 10, 50));
  const [guestRows, visitRows] = await Promise.all([
    db.select().from(guests).where(eq(guests.restaurantId, params.restaurantId)),
    db.select().from(visitLogs).where(eq(visitLogs.restaurantId, params.restaurantId)),
  ]);

  const visitsByGuest = new Map<string, typeof visitRows>();
  const periodVisitsByGuest = new Map<string, typeof visitRows>();
  for (const visit of visitRows) {
    visitsByGuest.set(visit.guestId, [...(visitsByGuest.get(visit.guestId) ?? []), visit]);
    if (isDateInPeriod(visit.date, period)) {
      periodVisitsByGuest.set(visit.guestId, [...(periodVisitsByGuest.get(visit.guestId) ?? []), visit]);
    }
  }

  const guestsWithValue = guestRows.map((guest) => {
    const lifetimeVisits = visitsByGuest.get(guest.id) ?? [];
    const periodVisits = periodVisitsByGuest.get(guest.id) ?? [];
    const lifetimeRevenue = sum(lifetimeVisits.map((visit) => visit.totalSpend ?? 0));
    const periodRevenue = sum(periodVisits.map((visit) => visit.totalSpend ?? 0));
    const firstVisitDate = guest.firstVisitDate ?? lifetimeVisits.map((visit) => visit.date).sort()[0] ?? null;
    const lastVisitDate = guest.lastVisitDate ?? lifetimeVisits.map((visit) => visit.date).sort().at(-1) ?? null;

    return {
      guestId: guest.id,
      name: guest.name,
      tier: guest.tier ?? "bronze",
      visitCount: guest.visitCount,
      firstVisitDate,
      lastVisitDate,
      lifetimeVisits: lifetimeVisits.length,
      periodVisits: periodVisits.length,
      lifetimeRevenue,
      periodRevenue,
      averageSpendPerVisit: average(lifetimeRevenue, lifetimeVisits.length),
      periodAverageSpendPerVisit: average(periodRevenue, periodVisits.length),
      pointsBalance: guest.pointsBalance,
    };
  });

  const byTier = (["bronze", "silver", "gold"] as const).map((tier) => {
    const tierGuests = guestsWithValue.filter((guest) => guest.tier === tier);
    const lifetimeRevenue = sum(tierGuests.map((guest) => guest.lifetimeRevenue));
    const periodRevenue = sum(tierGuests.map((guest) => guest.periodRevenue));
    const lifetimeVisits = sum(tierGuests.map((guest) => guest.lifetimeVisits));
    const periodVisits = sum(tierGuests.map((guest) => guest.periodVisits));
    return {
      tier,
      guests: tierGuests.length,
      lifetimeRevenue,
      periodRevenue,
      lifetimeVisits,
      periodVisits,
      averageLifetimeValue: average(lifetimeRevenue, tierGuests.length),
      averagePeriodValue: average(periodRevenue, tierGuests.length),
      averageSpendPerVisit: average(lifetimeRevenue, lifetimeVisits),
    };
  });

  const revenueGuests = guestsWithValue.filter((guest) => guest.lifetimeRevenue > 0);
  const lifetimeRevenue = sum(guestsWithValue.map((guest) => guest.lifetimeRevenue));
  const periodRevenue = sum(guestsWithValue.map((guest) => guest.periodRevenue));
  const lifetimeVisits = sum(guestsWithValue.map((guest) => guest.lifetimeVisits));
  const periodVisits = sum(guestsWithValue.map((guest) => guest.periodVisits));

  return {
    restaurantId: params.restaurantId,
    generatedAt: new Date().toISOString(),
    period,
    totals: {
      guests: guestsWithValue.length,
      guestsWithRevenue: revenueGuests.length,
      lifetimeRevenue,
      periodRevenue,
      lifetimeVisits,
      periodVisits,
      averageLifetimeValue: average(lifetimeRevenue, guestsWithValue.length),
      averageRevenueCustomerValue: average(lifetimeRevenue, revenueGuests.length),
      averagePeriodValue: average(periodRevenue, guestsWithValue.length),
      averageSpendPerVisit: average(lifetimeRevenue, lifetimeVisits),
    },
    byTier,
    topGuests: [...guestsWithValue]
      .sort((left, right) => right.lifetimeRevenue - left.lifetimeRevenue)
      .slice(0, topLimit),
  };
}

export async function getCampaignRoiAnalytics(params: {
  restaurantId: string;
  campaignId?: string;
  from?: string;
  to?: string;
  attributionDays?: number;
  costPerMessage?: number;
}) {
  const period = resolveAnalyticsPeriod(params);
  const attributionDays = Math.max(1, Math.min(params.attributionDays ?? DEFAULT_CAMPAIGN_ATTRIBUTION_DAYS, 90));
  const costPerMessage = Math.max(0, params.costPerMessage ?? DEFAULT_CAMPAIGN_COST_PER_MESSAGE);
  const fromDate = dateKeyToUtc(period.from);
  const toDate = new Date(`${period.to}T23:59:59.999Z`);
  const campaignWhere = params.campaignId
    ? and(eq(campaigns.restaurantId, params.restaurantId), eq(campaigns.id, params.campaignId))
    : and(
      eq(campaigns.restaurantId, params.restaurantId),
      gte(campaigns.createdAt, fromDate),
      lte(campaigns.createdAt, toDate),
    );

  const [campaignRows, reservationRows, visitRows] = await Promise.all([
    db.select().from(campaigns).where(campaignWhere),
    db.select().from(reservations).where(eq(reservations.restaurantId, params.restaurantId)),
    db.select().from(visitLogs).where(eq(visitLogs.restaurantId, params.restaurantId)),
  ]);
  const spendByReservation = new Map<string, number>();
  for (const visit of visitRows) {
    if (visit.reservationId) {
      spendByReservation.set(visit.reservationId, (spendByReservation.get(visit.reservationId) ?? 0) + (visit.totalSpend ?? 0));
    }
  }

  const items = campaignRows.map((campaign) => {
    const stats = asCampaignStats(campaign.stats);
    const sentRecipients = (stats.deliveryRecipients ?? []).filter((recipient) =>
      recipient.status === "sent" && typeof recipient.guestId === "string"
    );
    const sentGuestIds = new Set(sentRecipients.map((recipient) => recipient.guestId!));
    const sentAt = asDateKey(campaign.sentAt) ?? asDateKey(campaign.createdAt) ?? period.from;
    const attributionTo = addDays(sentAt, attributionDays);
    const attributedReservations = reservationRows.filter((reservation) =>
      sentGuestIds.has(reservation.guestId)
      && reservation.createdAt >= new Date(`${sentAt}T00:00:00.000Z`)
      && reservation.createdAt <= new Date(`${attributionTo}T23:59:59.999Z`)
    );
    const attributedRevenue = sum(attributedReservations.map((reservation) => spendByReservation.get(reservation.id) ?? 0));
    const estimatedCost = Number(((stats.delivery?.sent ?? sentRecipients.length) * costPerMessage).toFixed(2));

    return {
      campaignId: campaign.id,
      name: campaign.name,
      status: campaign.status,
      sentAt: campaign.sentAt?.toISOString() ?? null,
      attributionWindow: {
        from: sentAt,
        to: attributionTo,
        days: attributionDays,
      },
      delivery: {
        sent: stats.delivery?.sent ?? sentRecipients.length,
        delivered: stats.delivery?.delivered ?? sentRecipients.filter((recipient) => recipient.deliveredAt || recipient.readAt || recipient.repliedAt).length,
        read: stats.delivery?.read ?? sentRecipients.filter((recipient) => recipient.readAt || recipient.repliedAt).length,
        replied: stats.delivery?.replied ?? sentRecipients.filter((recipient) => recipient.repliedAt).length,
        skipped: stats.delivery?.skipped ?? 0,
      },
      attributedReservations: attributedReservations.length,
      attributedRevenue,
      estimatedCost,
      roi: estimatedCost > 0 ? Number((attributedRevenue / estimatedCost).toFixed(2)) : null,
    };
  });

  return {
    restaurantId: params.restaurantId,
    generatedAt: new Date().toISOString(),
    period,
    attributionDays,
    costPerMessage,
    campaigns: items,
    totals: {
      campaigns: items.length,
      sent: sum(items.map((item) => item.delivery.sent)),
      delivered: sum(items.map((item) => item.delivery.delivered)),
      read: sum(items.map((item) => item.delivery.read)),
      replied: sum(items.map((item) => item.delivery.replied)),
      attributedReservations: sum(items.map((item) => item.attributedReservations)),
      attributedRevenue: sum(items.map((item) => item.attributedRevenue)),
      estimatedCost: Number(sum(items.map((item) => item.estimatedCost)).toFixed(2)),
      roi: sum(items.map((item) => item.estimatedCost)) > 0
        ? Number((sum(items.map((item) => item.attributedRevenue)) / sum(items.map((item) => item.estimatedCost))).toFixed(2))
        : null,
    },
  };
}
