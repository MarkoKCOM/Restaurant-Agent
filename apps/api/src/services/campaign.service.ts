import { campaignQueue } from "../queue/index.js";
import { campaignRepository } from "../repositories/campaign.repository.js";
import { guestRepository } from "../repositories/guest.repository.js";
import { visitRepository } from "../repositories/visit.repository.js";
import {
  applyEngagementQuietHours,
  getRestaurantEngagementQuietHours,
  isDateInEngagementQuietHours,
} from "./engagement.service.js";

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

interface CampaignAudienceGuest {
  guestId: string;
  name: string;
  tier: "bronze" | "silver" | "gold" | null;
  visitCount: number;
  lastVisitDate: string | null;
  daysSinceLastVisit: number | null;
  totalSpend: number;
  tags: string[];
  optedOutCampaigns: boolean;
  pointsBalance: number;
}

interface CampaignDeliveryRecipient {
  guestId: string;
  status: "sent" | "skipped";
  reason?: "guest_opted_out_campaigns" | "campaign_weekly_limit_reached" | "campaign_monthly_limit_reached";
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  repliedAt?: string;
  skippedAt?: string;
  messagePreview?: string;
}

export type CampaignDeliveryEvent = "delivered" | "read" | "replied";

interface CampaignStats {
  delivery?: {
    sent?: number;
    delivered?: number;
    read?: number;
    replied?: number;
    skipped?: number;
    skippedOptedOut?: number;
    skippedRateLimitedWeek?: number;
    skippedRateLimitedMonth?: number;
    lastSentAt?: string;
    lastDeliveredAt?: string;
    lastReadAt?: string;
    lastRepliedAt?: string;
  };
  deliveryRecipients?: CampaignDeliveryRecipient[];
  schedule?: unknown;
  [key: string]: unknown;
}

const CAMPAIGN_WEEKLY_LIMIT = 2;
const CAMPAIGN_MONTHLY_LIMIT = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export const CAMPAIGN_PERSONALIZATION_VARIABLES = [
  "guest_name",
  "last_visit_date",
  "days_since_last_visit",
  "points_balance",
  "reward_teaser",
] as const;

export type CampaignPersonalizationVariable = typeof CAMPAIGN_PERSONALIZATION_VARIABLES[number];
export type CampaignTemplateId =
  | "we_miss_you"
  | "weekend_special"
  | "new_menu_item"
  | "birthday_month"
  | "loyalty_milestone";

export interface CampaignTemplateDefinition {
  id: CampaignTemplateId;
  name: string;
  category: "win_back" | "promotion" | "menu" | "birthday" | "loyalty";
  description: string;
  messageHe: string;
  messageEn: string;
  recommendedFilter: CampaignAudienceFilter;
  variables: CampaignPersonalizationVariable[];
}

export interface CampaignSchedulePreview {
  requestedScheduledAt: string | null;
  effectiveScheduledAt: string | null;
  status: "draft" | "scheduled";
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timeZone: string;
  };
  warnings: Array<{
    code: "CAMPAIGN_SCHEDULE_QUIET_HOURS" | "CAMPAIGN_SCHEDULE_PAST";
    message: string;
    suggestedScheduledAt?: string;
  }>;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplateDefinition[] = [
  {
    id: "we_miss_you",
    name: "We miss you",
    category: "win_back",
    description: "Bring lapsed regulars back with a clear reason to return.",
    messageHe: "היי {{guest_name}}, התגעגענו אליך. עברו {{days_since_last_visit}} ימים מהביקור האחרון - נשמח לראות אותך שוב עם {{reward_teaser}}.",
    messageEn: "Hi {{guest_name}}, we miss you. It has been {{days_since_last_visit}} days since your last visit - come back for {{reward_teaser}}.",
    recommendedFilter: { lapsedDays: 30, minVisits: 1 },
    variables: ["guest_name", "days_since_last_visit", "reward_teaser"],
  },
  {
    id: "weekend_special",
    name: "Weekend special",
    category: "promotion",
    description: "Fill priority weekend slots with members who already know the restaurant.",
    messageHe: "היי {{guest_name}}, יש לחברי המועדון סוף שבוע מיוחד: {{reward_teaser}}. להזמין לך מקום?",
    messageEn: "Hi {{guest_name}}, members get a weekend special: {{reward_teaser}}. Want me to book you a table?",
    recommendedFilter: { minVisits: 2, tiers: ["silver", "gold"] },
    variables: ["guest_name", "reward_teaser"],
  },
  {
    id: "new_menu_item",
    name: "New menu item",
    category: "menu",
    description: "Invite engaged members to try something new.",
    messageHe: "היי {{guest_name}}, הכנסנו מנה חדשה לתפריט וחשבנו שתאהב. לחברי המועדון יש {{reward_teaser}}.",
    messageEn: "Hi {{guest_name}}, we added something new to the menu and thought of you. Members get {{reward_teaser}}.",
    recommendedFilter: { minVisits: 1 },
    variables: ["guest_name", "reward_teaser"],
  },
  {
    id: "birthday_month",
    name: "Birthday month offer",
    category: "birthday",
    description: "Give birthday-month members a personal reason to celebrate in-house.",
    messageHe: "היי {{guest_name}}, חודש יום ההולדת שלך אצלנו במועדון כולל {{reward_teaser}}. לחגוג אצלנו?",
    messageEn: "Hi {{guest_name}}, your birthday month club benefit is {{reward_teaser}}. Want to celebrate with us?",
    recommendedFilter: { minVisits: 1 },
    variables: ["guest_name", "reward_teaser"],
  },
  {
    id: "loyalty_milestone",
    name: "Loyalty milestone approaching",
    category: "loyalty",
    description: "Nudge members who are close to their next club benefit.",
    messageHe: "היי {{guest_name}}, יש לך {{points_balance}} נקודות ואתה קרוב להטבה הבאה. הביקור הבא יכול לפתוח לך {{reward_teaser}}.",
    messageEn: "Hi {{guest_name}}, you have {{points_balance}} points and you are close to your next benefit. Your next visit can unlock {{reward_teaser}}.",
    recommendedFilter: { minVisits: 2 },
    variables: ["guest_name", "points_balance", "reward_teaser"],
  },
];

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

function asCampaignStats(value: unknown): CampaignStats {
  return typeof value === "object" && value !== null ? value as CampaignStats : {};
}

function stripAudienceMetadata(filter: unknown): CampaignAudienceFilter {
  if (typeof filter !== "object" || filter === null) return {};
  const raw = filter as CampaignAudienceFilter & {
    templateId?: unknown;
    variables?: unknown;
  };
  const {
    templateId: _templateId,
    variables: _variables,
    ...audienceFilter
  } = raw;
  return audienceFilter;
}

function renderCampaignMessage(templateText: string, guest: CampaignAudienceGuest): string {
  const replacements: Record<CampaignPersonalizationVariable, string> = {
    guest_name: guest.name,
    last_visit_date: guest.lastVisitDate ?? "",
    days_since_last_visit: guest.daysSinceLastVisit === null ? "" : String(guest.daysSinceLastVisit),
    points_balance: String(guest.pointsBalance),
    reward_teaser: "a member benefit",
  };

  return templateText.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) =>
    Object.prototype.hasOwnProperty.call(replacements, key) ? replacements[key as CampaignPersonalizationVariable] : "",
  );
}

function countPriorCampaignSends(params: {
  campaigns: Array<{ stats: unknown }>;
  guestId: string;
  since: Date;
  before: Date;
}): number {
  return params.campaigns.reduce((count, campaign) => {
    const stats = asCampaignStats(campaign.stats);
    const recipients = stats.deliveryRecipients ?? [];
    return count + recipients.filter((recipient) => {
      if (recipient.guestId !== params.guestId || recipient.status !== "sent" || !recipient.sentAt) return false;
      const sentAt = new Date(recipient.sentAt);
      return sentAt >= params.since && sentAt <= params.before;
    }).length;
  }, 0);
}

function recomputeDeliveryStats(params: {
  existingDelivery: CampaignStats["delivery"];
  recipients: CampaignDeliveryRecipient[];
}) {
  const sentRecipients = params.recipients.filter((recipient) => recipient.status === "sent");
  const skippedRecipients = params.recipients.filter((recipient) => recipient.status === "skipped");

  return {
    ...(params.existingDelivery ?? {}),
    sent: sentRecipients.length,
    delivered: sentRecipients.filter((recipient) => recipient.deliveredAt || recipient.readAt || recipient.repliedAt).length,
    read: sentRecipients.filter((recipient) => recipient.readAt || recipient.repliedAt).length,
    replied: sentRecipients.filter((recipient) => recipient.repliedAt).length,
    skipped: skippedRecipients.length,
    skippedOptedOut: skippedRecipients.filter((recipient) => recipient.reason === "guest_opted_out_campaigns").length,
    skippedRateLimitedWeek: skippedRecipients.filter((recipient) => recipient.reason === "campaign_weekly_limit_reached").length,
    skippedRateLimitedMonth: skippedRecipients.filter((recipient) => recipient.reason === "campaign_monthly_limit_reached").length,
  };
}

async function selectCampaignAudience(params: {
  restaurantId: string;
  filter: CampaignAudienceFilter;
}): Promise<{
  totalGuests: number;
  excludedOptedOut: number;
  matched: CampaignAudienceGuest[];
}> {
  const [guestRows, visitRows] = await Promise.all([
    guestRepository.listByRestaurantRecentFirst(params.restaurantId),
    visitRepository.findByRestaurant(params.restaurantId),
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
  }).map((guest) => ({
    guestId: guest.id,
    name: guest.name,
    tier: guest.tier,
    visitCount: guest.visitCount,
    lastVisitDate: guest.lastVisitDate,
    daysSinceLastVisit: daysSince(guest.lastVisitDate),
    totalSpend: spendByGuest.get(guest.id) ?? 0,
    tags: guest.tags ?? [],
    optedOutCampaigns: guest.optedOutCampaigns,
    pointsBalance: guest.pointsBalance,
  }));

  return {
    totalGuests: guestRows.length,
    excludedOptedOut,
    matched,
  };
}

function extractTemplateVariables(templateText: string): string[] {
  return [...templateText.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)]
    .map((match) => match[1]);
}

export function validateCampaignTemplateText(templateText: string): {
  variables: string[];
  unknownVariables: string[];
} {
  const variables = [...new Set(extractTemplateVariables(templateText))];
  const allowed = new Set<string>(CAMPAIGN_PERSONALIZATION_VARIABLES);
  return {
    variables,
    unknownVariables: variables.filter((variable) => !allowed.has(variable)),
  };
}

export function getCampaignTemplates() {
  return CAMPAIGN_TEMPLATES;
}

export async function previewCampaignSchedule(params: {
  restaurantId: string;
  scheduledAt?: Date | null;
  allowQuietHoursAdjustment?: boolean;
  now?: Date;
}): Promise<CampaignSchedulePreview> {
  const { timeZone, quietHours } = await getRestaurantEngagementQuietHours(params.restaurantId);
  const warnings: CampaignSchedulePreview["warnings"] = [];
  const now = params.now ?? new Date();

  if (!params.scheduledAt) {
    return {
      requestedScheduledAt: null,
      effectiveScheduledAt: null,
      status: "draft",
      quietHours: { ...quietHours, timeZone },
      warnings,
    };
  }

  let effectiveScheduledAt = params.scheduledAt;
  if (params.scheduledAt.getTime() <= now.getTime()) {
    warnings.push({
      code: "CAMPAIGN_SCHEDULE_PAST",
      message: "Scheduled time must be in the future.",
    });
  }

  if (isDateInEngagementQuietHours(params.scheduledAt, timeZone, quietHours)) {
    const suggested = applyEngagementQuietHours(params.scheduledAt, timeZone, quietHours);
    warnings.push({
      code: "CAMPAIGN_SCHEDULE_QUIET_HOURS",
      message: "Scheduled time is inside quiet hours.",
      suggestedScheduledAt: suggested.toISOString(),
    });
    if (params.allowQuietHoursAdjustment) {
      effectiveScheduledAt = suggested;
    }
  }

  return {
    requestedScheduledAt: params.scheduledAt.toISOString(),
    effectiveScheduledAt: effectiveScheduledAt.toISOString(),
    status: "scheduled",
    quietHours: { ...quietHours, timeZone },
    warnings,
  };
}

export async function createCampaign(params: {
  restaurantId: string;
  name: string;
  templateText: string;
  audienceFilter: CampaignAudienceFilter;
  templateId?: CampaignTemplateId;
  scheduledAt?: Date | null;
  allowQuietHoursAdjustment?: boolean;
}) {
  const templateValidation = validateCampaignTemplateText(params.templateText);
  if (templateValidation.unknownVariables.length > 0) {
    throw new Error(`Unknown campaign personalization variables: ${templateValidation.unknownVariables.join(", ")}`);
  }

  const schedule = await previewCampaignSchedule({
    restaurantId: params.restaurantId,
    scheduledAt: params.scheduledAt,
    allowQuietHoursAdjustment: params.allowQuietHoursAdjustment,
  });

  const hasBlockingScheduleWarning = schedule.warnings.some((warning) =>
    warning.code === "CAMPAIGN_SCHEDULE_PAST"
    || (warning.code === "CAMPAIGN_SCHEDULE_QUIET_HOURS" && !params.allowQuietHoursAdjustment)
  );
  if (hasBlockingScheduleWarning) {
    const error = new Error("Campaign schedule requires adjustment");
    (error as Error & { schedule?: CampaignSchedulePreview }).schedule = schedule;
    throw error;
  }

  const campaign = await campaignRepository.insert({
    restaurantId: params.restaurantId,
    name: params.name,
    templateText: params.templateText,
    audienceFilter: {
      ...params.audienceFilter,
      ...(params.templateId ? { templateId: params.templateId } : {}),
      variables: templateValidation.variables,
    },
    status: schedule.status,
    scheduledAt: schedule.effectiveScheduledAt ? new Date(schedule.effectiveScheduledAt) : null,
    stats: {
      delivery: {
        sent: 0,
        delivered: 0,
        read: 0,
        replied: 0,
      },
      schedule,
    },
  });

  if (schedule.effectiveScheduledAt) {
    const delay = new Date(schedule.effectiveScheduledAt).getTime() - Date.now();
    await campaignQueue.add(
      "campaign-delivery",
      { campaignId: campaign.id, restaurantId: params.restaurantId },
      { delay: Math.max(0, delay), jobId: `campaign-delivery-${campaign.id}` },
    );
  }

  return {
    campaign,
    schedule,
    variables: templateValidation.variables,
  };
}

export async function previewCampaignAudience(params: {
  restaurantId: string;
  filter: CampaignAudienceFilter;
  sampleLimit?: number;
}): Promise<CampaignAudiencePreview> {
  const audience = await selectCampaignAudience(params);

  const sample = audience.matched.slice(0, params.sampleLimit ?? 10).map((guest) => ({
    guestId: guest.guestId,
    name: guest.name,
    tier: guest.tier,
    visitCount: guest.visitCount,
    lastVisitDate: guest.lastVisitDate,
    daysSinceLastVisit: guest.daysSinceLastVisit,
    totalSpend: guest.totalSpend,
    tags: guest.tags,
    optedOutCampaigns: guest.optedOutCampaigns,
  }));

  return {
    restaurantId: params.restaurantId,
    generatedAt: new Date().toISOString(),
    totalGuests: audience.totalGuests,
    matchedCount: audience.matched.length,
    excludedOptedOut: audience.excludedOptedOut,
    filtersApplied: appliedFilters(params.filter),
    sample,
  };
}

export async function deliverCampaign(params: {
  campaignId: string;
  restaurantId: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const campaign = await campaignRepository.findByIdInRestaurant(
    params.campaignId,
    params.restaurantId,
  );

  if (!campaign) throw new Error("Campaign not found");
  if (!["draft", "scheduled"].includes(campaign.status)) {
    throw new Error(`Campaign cannot be delivered from status ${campaign.status}`);
  }

  const audienceFilter = stripAudienceMetadata(campaign.audienceFilter);
  const audience = await selectCampaignAudience({
    restaurantId: params.restaurantId,
    filter: {
      ...audienceFilter,
      includeOptedOut: true,
    },
  });
  const priorCampaigns = await campaignRepository.listByRestaurantExcluding(
    params.restaurantId,
    params.campaignId,
  );

  const recipients: CampaignDeliveryRecipient[] = [];
  let sent = 0;
  let skippedOptedOut = 0;
  let skippedRateLimitedWeek = 0;
  let skippedRateLimitedMonth = 0;

  for (const guest of audience.matched) {
    if (guest.optedOutCampaigns) {
      skippedOptedOut++;
      recipients.push({
        guestId: guest.guestId,
        status: "skipped",
        reason: "guest_opted_out_campaigns",
        skippedAt: now.toISOString(),
      });
      continue;
    }

    const weeklyCount = countPriorCampaignSends({
      campaigns: priorCampaigns,
      guestId: guest.guestId,
      since: new Date(now.getTime() - WEEK_MS),
      before: now,
    });
    if (weeklyCount >= CAMPAIGN_WEEKLY_LIMIT) {
      skippedRateLimitedWeek++;
      recipients.push({
        guestId: guest.guestId,
        status: "skipped",
        reason: "campaign_weekly_limit_reached",
        skippedAt: now.toISOString(),
      });
      continue;
    }

    const monthlyCount = countPriorCampaignSends({
      campaigns: priorCampaigns,
      guestId: guest.guestId,
      since: new Date(now.getTime() - MONTH_MS),
      before: now,
    });
    if (monthlyCount >= CAMPAIGN_MONTHLY_LIMIT) {
      skippedRateLimitedMonth++;
      recipients.push({
        guestId: guest.guestId,
        status: "skipped",
        reason: "campaign_monthly_limit_reached",
        skippedAt: now.toISOString(),
      });
      continue;
    }

    sent++;
    recipients.push({
      guestId: guest.guestId,
      status: "sent",
      sentAt: now.toISOString(),
      messagePreview: renderCampaignMessage(campaign.templateText, guest).slice(0, 240),
    });
  }

  const existingStats = asCampaignStats(campaign.stats);
  const delivery = {
    sent,
    delivered: existingStats.delivery?.delivered ?? 0,
    read: existingStats.delivery?.read ?? 0,
    replied: existingStats.delivery?.replied ?? 0,
    skipped: skippedOptedOut + skippedRateLimitedWeek + skippedRateLimitedMonth,
    skippedOptedOut,
    skippedRateLimitedWeek,
    skippedRateLimitedMonth,
    lastSentAt: now.toISOString(),
  };

  const updatedCampaign = await campaignRepository.updateById(params.campaignId, {
    status: "sent",
    sentAt: now,
    stats: {
      ...existingStats,
      delivery,
      deliveryRecipients: recipients,
      audience: {
        totalGuests: audience.totalGuests,
        matchedCount: audience.matched.length,
        filtersApplied: appliedFilters(audienceFilter),
      },
    },
  });

  if (!updatedCampaign) throw new Error("Failed to update campaign delivery stats");

  return {
    campaign: updatedCampaign,
    delivery,
    recipients,
  };
}

export async function recordCampaignDeliveryEvent(params: {
  campaignId: string;
  restaurantId: string;
  guestId: string;
  event: CampaignDeliveryEvent;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const timestamp = now.toISOString();
  const campaign = await campaignRepository.findByIdInRestaurant(
    params.campaignId,
    params.restaurantId,
  );

  if (!campaign) throw new Error("Campaign not found");

  const existingStats = asCampaignStats(campaign.stats);
  const recipients = [...(existingStats.deliveryRecipients ?? [])];
  const recipientIndex = recipients.findIndex((recipient) =>
    recipient.guestId === params.guestId && recipient.status === "sent"
  );
  if (recipientIndex === -1) {
    throw new Error("Campaign sent recipient not found");
  }

  const recipient = { ...recipients[recipientIndex] };
  if (params.event === "delivered") {
    recipient.deliveredAt ??= timestamp;
  } else if (params.event === "read") {
    recipient.deliveredAt ??= timestamp;
    recipient.readAt ??= timestamp;
  } else {
    recipient.deliveredAt ??= timestamp;
    recipient.readAt ??= timestamp;
    recipient.repliedAt ??= timestamp;
  }
  recipients[recipientIndex] = recipient;

  const delivery = {
    ...recomputeDeliveryStats({
      existingDelivery: existingStats.delivery,
      recipients,
    }),
    ...(params.event === "delivered" ? { lastDeliveredAt: timestamp } : {}),
    ...(params.event === "read" ? { lastReadAt: timestamp } : {}),
    ...(params.event === "replied" ? { lastRepliedAt: timestamp } : {}),
  };

  const updatedCampaign = await campaignRepository.updateById(params.campaignId, {
    stats: {
      ...existingStats,
      delivery,
      deliveryRecipients: recipients,
    },
  });

  if (!updatedCampaign) throw new Error("Failed to update campaign delivery event");

  return {
    campaign: updatedCampaign,
    delivery,
    recipient,
  };
}
