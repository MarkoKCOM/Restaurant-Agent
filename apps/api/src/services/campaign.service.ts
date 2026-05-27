import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests, visitLogs } from "../db/schema.js";

export interface CampaignAudienceFilter {
  minVisits?: number;
  maxVisits?: number;
  lapsedDays?: number;
  tiers?: Array<"bronze" | "silver" | "gold">;
  tagsAny?: string[];
  tagsAll?: string[];
  minTotalSpend?: number;
  maxTotalSpend?: number;
  sources?: Array<"whatsapp" | "web" | "walk_in" | "referral" | "telegram">;
  languages?: Array<"he" | "en" | "ar" | "ru">;
  includeOptedOut?: boolean;
}

export interface CampaignAudiencePreview {
  restaurantId: string;
  generatedAt: string;
  totalGuests: number;
  matchedCount: number;
  excludedOptedOut: number;
  filtersApplied: string[];
  sample: Array<{
    guestId: string;
    name: string;
    tier: string | null;
    visitCount: number;
    lastVisitDate: string | null;
    daysSinceLastVisit: number | null;
    totalSpend: number;
    tags: string[];
    optedOutCampaigns: boolean;
  }>;
}

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function daysSince(date: string | null, now = new Date()): number | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - parsed.getTime()) / 86_400_000);
}

function hasAnyTag(guestTags: string[], tags: string[]): boolean {
  if (tags.length === 0) return true;
  return tags.some((tag) => guestTags.includes(tag));
}

function hasAllTags(guestTags: string[], tags: string[]): boolean {
  return tags.every((tag) => guestTags.includes(tag));
}

function appliedFilters(filter: CampaignAudienceFilter): string[] {
  const result: string[] = [];
  if (filter.minVisits !== undefined) result.push(`minVisits:${filter.minVisits}`);
  if (filter.maxVisits !== undefined) result.push(`maxVisits:${filter.maxVisits}`);
  if (filter.lapsedDays !== undefined) result.push(`lapsedDays:${filter.lapsedDays}`);
  if (filter.tiers?.length) result.push(`tiers:${filter.tiers.join(",")}`);
  if (filter.tagsAny?.length) result.push(`tagsAny:${filter.tagsAny.join(",")}`);
  if (filter.tagsAll?.length) result.push(`tagsAll:${filter.tagsAll.join(",")}`);
  if (filter.minTotalSpend !== undefined) result.push(`minTotalSpend:${filter.minTotalSpend}`);
  if (filter.maxTotalSpend !== undefined) result.push(`maxTotalSpend:${filter.maxTotalSpend}`);
  if (filter.sources?.length) result.push(`sources:${filter.sources.join(",")}`);
  if (filter.languages?.length) result.push(`languages:${filter.languages.join(",")}`);
  result.push(`includeOptedOut:${filter.includeOptedOut === true ? "yes" : "no"}`);
  return result;
}

export async function previewCampaignAudience(params: {
  restaurantId: string;
  filter: CampaignAudienceFilter;
  sampleLimit?: number;
}): Promise<CampaignAudiencePreview> {
  const [guestRows, visitRows] = await Promise.all([
    db
      .select()
      .from(guests)
      .where(eq(guests.restaurantId, params.restaurantId))
      .orderBy(desc(guests.lastVisitDate), desc(guests.createdAt)),
    db
      .select({
        guestId: visitLogs.guestId,
        totalSpend: visitLogs.totalSpend,
      })
      .from(visitLogs)
      .where(eq(visitLogs.restaurantId, params.restaurantId)),
  ]);

  const spendByGuest = new Map<string, number>();
  for (const row of visitRows) {
    spendByGuest.set(row.guestId, (spendByGuest.get(row.guestId) ?? 0) + (row.totalSpend ?? 0));
  }

  const cutoffDate = params.filter.lapsedDays !== undefined ? dateDaysAgo(params.filter.lapsedDays) : null;
  let excludedOptedOut = 0;

  const matched = guestRows.filter((guest) => {
    const tags = guest.tags ?? [];
    const totalSpend = spendByGuest.get(guest.id) ?? 0;

    if (guest.optedOutCampaigns && params.filter.includeOptedOut !== true) {
      excludedOptedOut++;
      return false;
    }
    if (params.filter.minVisits !== undefined && guest.visitCount < params.filter.minVisits) return false;
    if (params.filter.maxVisits !== undefined && guest.visitCount > params.filter.maxVisits) return false;
    if (cutoffDate && (!guest.lastVisitDate || guest.lastVisitDate > cutoffDate)) return false;
    if (params.filter.tiers?.length && (!guest.tier || !params.filter.tiers.includes(guest.tier))) return false;
    if (params.filter.tagsAny?.length && !hasAnyTag(tags, params.filter.tagsAny)) return false;
    if (params.filter.tagsAll?.length && !hasAllTags(tags, params.filter.tagsAll)) return false;
    if (params.filter.minTotalSpend !== undefined && totalSpend < params.filter.minTotalSpend) return false;
    if (params.filter.maxTotalSpend !== undefined && totalSpend > params.filter.maxTotalSpend) return false;
    if (params.filter.sources?.length && !params.filter.sources.includes(guest.source)) return false;
    if (params.filter.languages?.length && !params.filter.languages.includes(guest.language)) return false;
    return true;
  });

  const sample = matched.slice(0, params.sampleLimit ?? 10).map((guest) => ({
    guestId: guest.id,
    name: guest.name,
    tier: guest.tier,
    visitCount: guest.visitCount,
    lastVisitDate: guest.lastVisitDate,
    daysSinceLastVisit: daysSince(guest.lastVisitDate),
    totalSpend: spendByGuest.get(guest.id) ?? 0,
    tags: guest.tags ?? [],
    optedOutCampaigns: guest.optedOutCampaigns,
  }));

  return {
    restaurantId: params.restaurantId,
    generatedAt: new Date().toISOString(),
    totalGuests: guestRows.length,
    matchedCount: matched.length,
    excludedOptedOut,
    filtersApplied: appliedFilters(params.filter),
    sample,
  };
}
