import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { outboundMessages, restaurants } from "../db/schema.js";

const MAX_PREVIEW_LENGTH = 1200;

export type OutboundMessageStatus = "logged" | "sent" | "failed" | "skipped";

export interface LogOutboundMessageParams {
  restaurantId: string;
  guestId?: string | null;
  channel?: string;
  provider?: string;
  recipient?: string | null;
  recipientMasked?: string | null;
  messageType: string;
  messageCategory?: "transactional" | "promotional";
  subjectType?: string | null;
  subjectId?: string | null;
  status?: OutboundMessageStatus;
  text: string;
  payload?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  sentAt?: Date | null;
}

export interface RecordOutboundDeliveryParams extends Omit<LogOutboundMessageParams, "status" | "errorCode" | "errorMessage" | "sentAt"> {
  requireRecipient?: boolean;
}

export interface ListOutboundMessagesParams {
  restaurantId: string;
  status?: string;
  messageType?: string;
  limit?: number;
}

export interface OutboundMessageDiagnostics {
  status: "ok" | "attention" | "error";
  since?: string;
  totals?: {
    total: number;
    logged: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  byType?: Record<string, number>;
  byErrorCode?: Record<string, number>;
  deliveryReadiness?: {
    ownerWhatsappMissing: number;
    ownerDeliveryRecipientMissing: number;
    ownerDeliveryFallbackAvailable: number;
    ownerWhatsappMissingSamples: Array<{
      restaurantId: string;
      slug: string;
      name: string;
      ownerPhoneMasked: string | null;
      whatsappNumberMasked: string | null;
      phoneMasked: string | null;
    }>;
  };
  samples?: Array<{
    id: string;
    restaurantId: string;
    guestId: string | null;
    channel: string;
    provider: string;
    recipientMasked: string | null;
    messageType: string;
    messageCategory: string;
    subjectType: string | null;
    subjectId: string | null;
    status: string;
    textPreview: string;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
  error?: {
    name: string;
    message: string;
  };
}

export function maskRecipient(recipient: string | null | undefined): string | null {
  if (!recipient) return null;
  const normalized = recipient.replace(/\s+/g, "");
  if (normalized.length <= 4) return "****";
  return `${normalized.slice(0, 3)}****${normalized.slice(-2)}`;
}

function previewText(text: string): string {
  return text.length > MAX_PREVIEW_LENGTH ? `${text.slice(0, MAX_PREVIEW_LENGTH - 3)}...` : text;
}

export async function logOutboundMessage(params: LogOutboundMessageParams) {
  const [row] = await db
    .insert(outboundMessages)
    .values({
      restaurantId: params.restaurantId,
      guestId: params.guestId ?? null,
      channel: params.channel ?? "whatsapp",
      provider: params.provider ?? "debug_log",
      recipientMasked: params.recipientMasked ?? maskRecipient(params.recipient),
      messageType: params.messageType,
      messageCategory: params.messageCategory ?? "transactional",
      subjectType: params.subjectType ?? null,
      subjectId: params.subjectId ?? null,
      status: params.status ?? "logged",
      textPreview: previewText(params.text),
      payload: params.payload ?? {},
      errorCode: params.errorCode ?? null,
      errorMessage: params.errorMessage ?? null,
      sentAt: params.sentAt ?? null,
    })
    .returning();

  return row;
}

export async function recordOutboundDelivery(params: RecordOutboundDeliveryParams) {
  const hasRecipient = Boolean(params.recipient || params.recipientMasked);
  const missingRequiredRecipient = params.requireRecipient !== false && !hasRecipient;

  return logOutboundMessage({
    ...params,
    provider: params.provider ?? "debug_log",
    status: missingRequiredRecipient ? "skipped" : "logged",
    errorCode: missingRequiredRecipient ? "OUTBOUND_RECIPIENT_MISSING" : null,
    errorMessage: missingRequiredRecipient ? "Outbound recipient is not configured." : null,
    payload: {
      ...params.payload,
      deliveryMode: "debug_log",
      deliverySkipped: missingRequiredRecipient,
    },
  });
}

export async function listOutboundMessages(params: ListOutboundMessagesParams) {
  const clauses = [eq(outboundMessages.restaurantId, params.restaurantId)];
  if (params.status) clauses.push(eq(outboundMessages.status, params.status));
  if (params.messageType) clauses.push(eq(outboundMessages.messageType, params.messageType));

  return db
    .select()
    .from(outboundMessages)
    .where(and(...clauses))
    .orderBy(desc(outboundMessages.createdAt))
    .limit(Math.min(Math.max(params.limit ?? 50, 1), 200));
}

export async function getOutboundMessageDiagnostics(params: {
  since?: Date;
  sampleLimit?: number;
} = {}): Promise<OutboundMessageDiagnostics> {
  const since = params.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sampleLimit = Math.min(Math.max(params.sampleLimit ?? 5, 1), 20);
  const [summaryRows, errorRows, sampleRows, ownerWhatsappMissingRows] = await Promise.all([
    db
      .select({
        status: outboundMessages.status,
        messageType: outboundMessages.messageType,
        count: sql<number>`count(*)::int`,
      })
      .from(outboundMessages)
      .where(gte(outboundMessages.createdAt, since))
      .groupBy(outboundMessages.status, outboundMessages.messageType),
    db
      .select({
        errorCode: outboundMessages.errorCode,
        count: sql<number>`count(*)::int`,
      })
      .from(outboundMessages)
      .where(and(gte(outboundMessages.createdAt, since), sql`${outboundMessages.errorCode} is not null`))
      .groupBy(outboundMessages.errorCode),
    db
      .select({
        id: outboundMessages.id,
        restaurantId: outboundMessages.restaurantId,
        guestId: outboundMessages.guestId,
        channel: outboundMessages.channel,
        provider: outboundMessages.provider,
        recipientMasked: outboundMessages.recipientMasked,
        messageType: outboundMessages.messageType,
        messageCategory: outboundMessages.messageCategory,
        subjectType: outboundMessages.subjectType,
        subjectId: outboundMessages.subjectId,
        status: outboundMessages.status,
        textPreview: outboundMessages.textPreview,
        errorCode: outboundMessages.errorCode,
        errorMessage: outboundMessages.errorMessage,
        createdAt: outboundMessages.createdAt,
      })
      .from(outboundMessages)
      .where(gte(outboundMessages.createdAt, since))
      .orderBy(
        sql`case when ${outboundMessages.errorCode} is not null or ${outboundMessages.status} in ('failed', 'skipped') then 0 else 1 end`,
        desc(outboundMessages.createdAt),
      )
      .limit(sampleLimit),
    db
      .select({
        restaurantId: restaurants.id,
        slug: restaurants.slug,
        name: restaurants.name,
        ownerPhone: restaurants.ownerPhone,
        whatsappNumber: restaurants.whatsappNumber,
        phone: restaurants.phone,
        missingCount: sql<number>`count(*) over()::int`,
        recipientMissingCount: sql<number>`count(*) filter (
          where (${restaurants.ownerPhone} is null or trim(${restaurants.ownerPhone}) = '')
            and (${restaurants.whatsappNumber} is null or trim(${restaurants.whatsappNumber}) = '')
            and (${restaurants.phone} is null or trim(${restaurants.phone}) = '')
        ) over()::int`,
        fallbackAvailableCount: sql<number>`count(*) filter (
          where (${restaurants.ownerPhone} is not null and trim(${restaurants.ownerPhone}) <> '')
            or (${restaurants.whatsappNumber} is not null and trim(${restaurants.whatsappNumber}) <> '')
            or (${restaurants.phone} is not null and trim(${restaurants.phone}) <> '')
        ) over()::int`,
      })
      .from(restaurants)
      .where(sql`${restaurants.ownerWhatsapp} is null or trim(${restaurants.ownerWhatsapp}) = ''`)
      .orderBy(restaurants.name)
      .limit(sampleLimit),
  ]);

  const totals = {
    total: 0,
    logged: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };
  const byType: Record<string, number> = {};
  const byErrorCode: Record<string, number> = {};
  for (const row of summaryRows) {
    const count = Number(row.count ?? 0);
    totals.total += count;
    if (row.status in totals) {
      totals[row.status as keyof typeof totals] += count;
    }
    byType[row.messageType] = (byType[row.messageType] ?? 0) + count;
  }
  for (const row of errorRows) {
    if (!row.errorCode) continue;
    byErrorCode[row.errorCode] = Number(row.count ?? 0);
  }
  const ownerWhatsappMissing = Number(ownerWhatsappMissingRows[0]?.missingCount ?? 0);
  const ownerDeliveryRecipientMissing = Number(ownerWhatsappMissingRows[0]?.recipientMissingCount ?? 0);
  const ownerDeliveryFallbackAvailable = Number(ownerWhatsappMissingRows[0]?.fallbackAvailableCount ?? 0);

  return {
    status: totals.failed > 0 || Object.keys(byErrorCode).length > 0 || ownerDeliveryRecipientMissing > 0 || ownerWhatsappMissing > 0 ? "attention" : "ok",
    since: since.toISOString(),
    totals,
    byType,
    byErrorCode,
    deliveryReadiness: {
      ownerWhatsappMissing,
      ownerDeliveryRecipientMissing,
      ownerDeliveryFallbackAvailable,
      ownerWhatsappMissingSamples: ownerWhatsappMissingRows.map((row) => ({
        restaurantId: row.restaurantId,
        slug: row.slug,
        name: row.name,
        ownerPhoneMasked: maskRecipient(row.ownerPhone),
        whatsappNumberMasked: maskRecipient(row.whatsappNumber),
        phoneMasked: maskRecipient(row.phone),
      })),
    },
    samples: sampleRows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
