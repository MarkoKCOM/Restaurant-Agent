import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { outboundMessages } from "../db/schema.js";
import type { Executor } from "./types.js";

export type OutboundMessageRow = InferSelectModel<typeof outboundMessages>;
export type OutboundMessageInsert = InferInsertModel<typeof outboundMessages>;

export interface OutboundStatusTypeCount {
  status: string;
  messageType: string;
  count: number;
}
export interface OutboundErrorBreakdown {
  errorCode: string | null;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}
export interface OutboundSampleRow {
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
  createdAt: Date;
}

/**
 * Data access for the `outboundMessages` log. Covers the insert/list paths plus
 * the diagnostics aggregations (status/type rollup, error breakdown, prioritized
 * sample) — the grouping/ordering SQL is preserved exactly.
 */
export const outboundMessageRepository = {
  async insert(
    values: OutboundMessageInsert,
    executor: Executor = db,
  ): Promise<OutboundMessageRow> {
    const [row] = await executor.insert(outboundMessages).values(values).returning();
    return row;
  },

  list(
    params: { restaurantId: string; status?: string; messageType?: string; limit?: number },
    executor: Executor = db,
  ): Promise<OutboundMessageRow[]> {
    const clauses = [eq(outboundMessages.restaurantId, params.restaurantId)];
    if (params.status) clauses.push(eq(outboundMessages.status, params.status));
    if (params.messageType) clauses.push(eq(outboundMessages.messageType, params.messageType));
    return executor
      .select()
      .from(outboundMessages)
      .where(and(...clauses))
      .orderBy(desc(outboundMessages.createdAt))
      .limit(Math.min(Math.max(params.limit ?? 50, 1), 200));
  },

  summarizeSince(since: Date, executor: Executor = db): Promise<OutboundStatusTypeCount[]> {
    return executor
      .select({
        status: outboundMessages.status,
        messageType: outboundMessages.messageType,
        count: sql<number>`count(*)::int`,
      })
      .from(outboundMessages)
      .where(gte(outboundMessages.createdAt, since))
      .groupBy(outboundMessages.status, outboundMessages.messageType);
  },

  errorBreakdownSince(since: Date, executor: Executor = db): Promise<OutboundErrorBreakdown[]> {
    return executor
      .select({
        errorCode: outboundMessages.errorCode,
        count: sql<number>`count(*)::int`,
        firstSeenAt: sql<Date>`min(${outboundMessages.createdAt})`,
        lastSeenAt: sql<Date>`max(${outboundMessages.createdAt})`,
      })
      .from(outboundMessages)
      .where(and(gte(outboundMessages.createdAt, since), sql`${outboundMessages.errorCode} is not null`))
      .groupBy(outboundMessages.errorCode);
  },

  sampleSince(since: Date, limit: number, executor: Executor = db): Promise<OutboundSampleRow[]> {
    return executor
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
      .limit(limit);
  },
};
