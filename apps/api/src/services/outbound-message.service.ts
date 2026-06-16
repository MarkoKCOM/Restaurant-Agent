import { outboundMessageRepository } from "../repositories/outbound-message.repository.js";
import { restaurantRepository } from "../repositories/restaurant.repository.js";

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
  statusReasons?: string[];
  totals?: {
    total: number;
    logged: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  byType?: Record<string, number>;
  byErrorCode?: Record<string, number>;
  byErrorCodeDetails?: Record<string, {
    count: number;
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
  deliveryReadiness?: {
    ownerWhatsappMissing: number;
    ownerDeliveryRecipientMissing: number;
    ownerDeliveryFallbackAvailable: number;
    ownerDeliveryBlocked: boolean;
    ownerWhatsappConfigOnlyMissing: boolean;
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

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date(0).toISOString();
}

export async function logOutboundMessage(params: LogOutboundMessageParams) {
  return outboundMessageRepository.insert({
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
  });
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
  return outboundMessageRepository.list(params);
}

export async function getOutboundMessageDiagnostics(params: {
  since?: Date;
  sampleLimit?: number;
} = {}): Promise<OutboundMessageDiagnostics> {
  const since = params.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sampleLimit = Math.min(Math.max(params.sampleLimit ?? 5, 1), 20);
  const [summaryRows, errorRows, sampleRows, ownerWhatsappMissingRows] = await Promise.all([
    outboundMessageRepository.summarizeSince(since),
    outboundMessageRepository.errorBreakdownSince(since),
    outboundMessageRepository.sampleSince(since, sampleLimit),
    restaurantRepository.findOwnerWhatsappMissing(sampleLimit),
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
  const byErrorCodeDetails: NonNullable<OutboundMessageDiagnostics["byErrorCodeDetails"]> = {};
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
    const count = Number(row.count ?? 0);
    byErrorCode[row.errorCode] = count;
    byErrorCodeDetails[row.errorCode] = {
      count,
      firstSeenAt: toIsoString(row.firstSeenAt),
      lastSeenAt: toIsoString(row.lastSeenAt),
    };
  }
  const ownerWhatsappMissing = Number(ownerWhatsappMissingRows[0]?.missingCount ?? 0);
  const ownerDeliveryRecipientMissing = Number(ownerWhatsappMissingRows[0]?.recipientMissingCount ?? 0);
  const ownerDeliveryFallbackAvailable = Number(ownerWhatsappMissingRows[0]?.fallbackAvailableCount ?? 0);
  const statusReasons: string[] = [];
  if (totals.failed > 0) statusReasons.push("failed_outbound_messages");
  if (Object.keys(byErrorCode).length > 0) statusReasons.push("historical_delivery_errors");
  if (ownerDeliveryRecipientMissing > 0) statusReasons.push("owner_delivery_recipient_missing");
  if (ownerWhatsappMissing > 0) statusReasons.push("owner_whatsapp_config_missing");
  const ownerDeliveryBlocked = ownerDeliveryRecipientMissing > 0;
  const ownerWhatsappConfigOnlyMissing = ownerWhatsappMissing > 0 && !ownerDeliveryBlocked;

  return {
    status: statusReasons.length > 0 ? "attention" : "ok",
    statusReasons,
    since: since.toISOString(),
    totals,
    byType,
    byErrorCode,
    byErrorCodeDetails,
    deliveryReadiness: {
      ownerWhatsappMissing,
      ownerDeliveryRecipientMissing,
      ownerDeliveryFallbackAvailable,
      ownerDeliveryBlocked,
      ownerWhatsappConfigOnlyMissing,
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
