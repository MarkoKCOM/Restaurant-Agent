import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import { challengeProgress, challenges } from "../db/schema.js";
import type { Executor } from "./types.js";

export type ChallengeRow = InferSelectModel<typeof challenges>;
export type ChallengeProgressRow = InferSelectModel<typeof challengeProgress>;

/**
 * Data access for the `challenges` and `challengeProgress` tables. Seeded here
 * for the guest-profile read; the engagement-cluster migration (tasks group 3.5)
 * extends it. Business logic stays in the challenge/guest services.
 */
export const challengeRepository = {
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

  /** Tenant-scoped: all challenges for a restaurant. */
  findByRestaurant(restaurantId: string, executor: Executor = db): Promise<ChallengeRow[]> {
    return executor.select().from(challenges).where(eq(challenges.restaurantId, restaurantId));
  },
};
