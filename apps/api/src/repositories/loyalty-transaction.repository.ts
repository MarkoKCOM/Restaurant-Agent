import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { loyaltyTransactions } from "../db/schema.js";
import type { Executor } from "./types.js";

export type LoyaltyTransactionRow = InferSelectModel<typeof loyaltyTransactions>;
export type LoyaltyTransactionInsert = InferInsertModel<typeof loyaltyTransactions>;

/**
 * Data access for the `loyaltyTransactions` ledger. The idempotency lookups
 * preserve the exact filters the loyalty service relies on to avoid
 * double-awarding points for the same reservation.
 */
export const loyaltyTransactionRepository = {
  async insert(
    values: LoyaltyTransactionInsert,
    executor: Executor = db,
  ): Promise<LoyaltyTransactionRow> {
    const [created] = await executor.insert(loyaltyTransactions).values(values).returning();
    if (!created) {
      throw new Error("Failed to record loyalty transaction");
    }
    return created;
  },

  /** By global guest UUID: transaction history newest-first, optionally limited. */
  findByGuest(
    guestId: string,
    options: { limit?: number } = {},
    executor: Executor = db,
  ): Promise<LoyaltyTransactionRow[]> {
    const base = executor
      .select()
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.guestId, guestId))
      .orderBy(desc(loyaltyTransactions.createdAt));
    return options.limit != null ? base.limit(options.limit) : base;
  },

  /** Tenant-scoped: transactions created within a date range (analytics). */
  listByRestaurantInRange(
    restaurantId: string,
    from: Date,
    to: Date,
    executor: Executor = db,
  ): Promise<LoyaltyTransactionRow[]> {
    return executor
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.restaurantId, restaurantId),
          gte(loyaltyTransactions.createdAt, from),
          lte(loyaltyTransactions.createdAt, to),
        ),
      );
  },

  /** All transactions for a guest with a specific reason (e.g. referral_bonus totals). */
  listByGuestAndReason(
    guestId: string,
    reason: string,
    executor: Executor = db,
  ): Promise<LoyaltyTransactionRow[]> {
    return executor
      .select()
      .from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.guestId, guestId), eq(loyaltyTransactions.reason, reason)));
  },

  /** Idempotency: an existing "earn" transaction for this reservation with a specific reason. */
  async findEarnByReason(
    guestId: string,
    restaurantId: string,
    reservationId: string,
    reason: string,
    executor: Executor = db,
  ): Promise<LoyaltyTransactionRow | null> {
    const [row] = await executor
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.guestId, guestId),
          eq(loyaltyTransactions.restaurantId, restaurantId),
          eq(loyaltyTransactions.reservationId, reservationId),
          eq(loyaltyTransactions.type, "earn"),
          eq(loyaltyTransactions.reason, reason),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /**
   * Idempotency (reservation-independent): an existing "earn" transaction for a
   * guest with a specific reason, across all reservations (e.g. streak milestones).
   */
  async findEarnByReasonForGuest(
    guestId: string,
    restaurantId: string,
    reason: string,
    executor: Executor = db,
  ): Promise<LoyaltyTransactionRow | null> {
    const [row] = await executor
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.guestId, guestId),
          eq(loyaltyTransactions.restaurantId, restaurantId),
          eq(loyaltyTransactions.type, "earn"),
          eq(loyaltyTransactions.reason, reason),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /** The most recent lucky-spin award for a guest at a restaurant, if any. */
  async findLatestLuckySpin(
    guestId: string,
    restaurantId: string,
    executor: Executor = db,
  ): Promise<LoyaltyTransactionRow | null> {
    const [row] = await executor
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.guestId, guestId),
          eq(loyaltyTransactions.restaurantId, restaurantId),
          sql`${loyaltyTransactions.reason} like 'lucky_spin:%'`,
        ),
      )
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(1);
    return row ?? null;
  },

  /** Idempotency: an existing lucky-spin award (reason prefixed `lucky_spin:`) for this reservation. */
  async findLuckySpinForVisit(
    guestId: string,
    restaurantId: string,
    reservationId: string,
    executor: Executor = db,
  ): Promise<LoyaltyTransactionRow | null> {
    const [row] = await executor
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.guestId, guestId),
          eq(loyaltyTransactions.restaurantId, restaurantId),
          eq(loyaltyTransactions.reservationId, reservationId),
          sql`${loyaltyTransactions.reason} like 'lucky_spin:%'`,
        ),
      )
      .limit(1);
    return row ?? null;
  },
};
