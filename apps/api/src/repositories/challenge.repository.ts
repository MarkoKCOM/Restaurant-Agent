import { and, eq, inArray, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { challengeProgress, challenges } from "../db/schema.js";
import type { Executor } from "./types.js";

export type ChallengeRow = InferSelectModel<typeof challenges>;
export type ChallengeInsert = InferInsertModel<typeof challenges>;
export type ChallengeUpdate = Partial<Omit<ChallengeInsert, "id" | "restaurantId">>;
export type ChallengeProgressRow = InferSelectModel<typeof challengeProgress>;
export type ChallengeProgressInsert = InferInsertModel<typeof challengeProgress>;
export type ChallengeProgressUpdate = Partial<
  Omit<ChallengeProgressInsert, "id" | "challengeId" | "guestId">
>;

/**
 * Data access for the `challenges` and `challengeProgress` tables. Tenant
 * scoping (`restaurantId`) is applied on the challenge catalog reads/writes;
 * progress rows are keyed by the guest+challenge pair.
 */
export const challengeRepository = {
  // ── challenges ────────────────────────────────────────

  async insert(values: ChallengeInsert, executor: Executor = db): Promise<ChallengeRow> {
    const [created] = await executor.insert(challenges).values(values).returning();
    if (!created) {
      throw new Error("Failed to create challenge");
    }
    return created;
  },

  /** By global challenge UUID. */
  async findById(id: string, executor: Executor = db): Promise<ChallengeRow | null> {
    const [row] = await executor
      .select()
      .from(challenges)
      .where(eq(challenges.id, id))
      .limit(1);
    return row ?? null;
  },

  /** Tenant-scoped: a challenge by id within a restaurant. */
  async findByIdInRestaurant(
    id: string,
    restaurantId: string,
    executor: Executor = db,
  ): Promise<ChallengeRow | null> {
    const [row] = await executor
      .select()
      .from(challenges)
      .where(and(eq(challenges.id, id), eq(challenges.restaurantId, restaurantId)))
      .limit(1);
    return row ?? null;
  },

  /** Tenant-scoped: active challenges whose optional launch window contains `today`. */
  listActive(
    restaurantId: string,
    today: string,
    executor: Executor = db,
  ): Promise<ChallengeRow[]> {
    return executor
      .select()
      .from(challenges)
      .where(
        and(
          eq(challenges.restaurantId, restaurantId),
          eq(challenges.isActive, true),
          sql`(${challenges.startDate} IS NULL OR ${challenges.startDate} <= ${today})`,
          sql`(${challenges.endDate} IS NULL OR ${challenges.endDate} >= ${today})`,
        ),
      );
  },

  /** Tenant-scoped: active challenges of the given types within the launch window. */
  listActiveByTypes(
    restaurantId: string,
    today: string,
    types: string[],
    executor: Executor = db,
  ): Promise<ChallengeRow[]> {
    return executor
      .select()
      .from(challenges)
      .where(
        and(
          eq(challenges.restaurantId, restaurantId),
          eq(challenges.isActive, true),
          inArray(challenges.type, types),
          sql`(${challenges.startDate} IS NULL OR ${challenges.startDate} <= ${today})`,
          sql`(${challenges.endDate} IS NULL OR ${challenges.endDate} >= ${today})`,
        ),
      );
  },

  /** The birthday-week challenge for a guest in a given occurrence year, if one exists. */
  async findBirthdayWeek(
    restaurantId: string,
    guestId: string,
    occurrenceYear: number,
    executor: Executor = db,
  ): Promise<ChallengeRow | null> {
    const [row] = await executor
      .select()
      .from(challenges)
      .where(
        and(
          eq(challenges.restaurantId, restaurantId),
          eq(challenges.type, "birthday_week"),
          sql`${challenges.metadata} ->> 'source' = 'birthday_week'`,
          sql`${challenges.metadata} ->> 'guestId' = ${guestId}`,
          sql`(${challenges.metadata} ->> 'occurrenceYear')::int = ${occurrenceYear}`,
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /** Tenant-scoped: update a challenge within a restaurant. */
  async updateInRestaurant(
    id: string,
    restaurantId: string,
    updates: ChallengeUpdate,
    executor: Executor = db,
  ): Promise<ChallengeRow | null> {
    const [updated] = await executor
      .update(challenges)
      .set(updates)
      .where(and(eq(challenges.id, id), eq(challenges.restaurantId, restaurantId)))
      .returning();
    return updated ?? null;
  },

  /** Tenant-scoped: all challenges for a restaurant (used by the guest profile view). */
  findByRestaurant(restaurantId: string, executor: Executor = db): Promise<ChallengeRow[]> {
    return executor
      .select()
      .from(challenges)
      .where(eq(challenges.restaurantId, restaurantId));
  },

  // ── challengeProgress ─────────────────────────────────

  /** By global guest UUID: progress rows for a guest across all challenges. */
  findProgressByGuest(
    guestId: string,
    executor: Executor = db,
  ): Promise<ChallengeProgressRow[]> {
    return executor
      .select()
      .from(challengeProgress)
      .where(eq(challengeProgress.guestId, guestId));
  },

  /** A guest's progress on a specific challenge. */
  async findProgress(
    guestId: string,
    challengeId: string,
    executor: Executor = db,
  ): Promise<ChallengeProgressRow | null> {
    const [row] = await executor
      .select()
      .from(challengeProgress)
      .where(
        and(
          eq(challengeProgress.guestId, guestId),
          eq(challengeProgress.challengeId, challengeId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async insertProgress(
    values: ChallengeProgressInsert,
    executor: Executor = db,
  ): Promise<ChallengeProgressRow> {
    const [created] = await executor.insert(challengeProgress).values(values).returning();
    if (!created) {
      throw new Error("Failed to create challenge progress");
    }
    return created;
  },

  /** By global progress UUID. Returns the updated row, or null when none matched. */
  async updateProgressById(
    id: string,
    updates: ChallengeProgressUpdate,
    executor: Executor = db,
  ): Promise<ChallengeProgressRow | null> {
    const [updated] = await executor
      .update(challengeProgress)
      .set(updates)
      .where(eq(challengeProgress.id, id))
      .returning();
    return updated ?? null;
  },
};
