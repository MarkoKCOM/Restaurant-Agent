import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests, loyaltyTransactions } from "../db/schema.js";
import type { Executor } from "./types.js";

export interface LeaderboardEntryRow {
  guest_id: string;
  guest_name: string;
  tier: string;
  visit_count: number;
  points_earned: number;
  rank: number;
}

/**
 * Raw-SQL aggregations for the opt-in monthly leaderboard. Kept in one place so
 * the window-function ranking and the participant count live behind the seam
 * rather than inline in the service.
 */
export const leaderboardRepository = {
  async fetchEntries(
    restaurantId: string,
    startIso: string,
    endIso: string,
    limit: number,
    executor: Executor = db,
  ): Promise<LeaderboardEntryRow[]> {
    return (await executor.execute(sql`
    with opted_in as (
      select
        id,
        name,
        tier,
        visit_count
      from ${guests}
      where restaurant_id = ${restaurantId}
        and preferences->'leaderboard'->>'optedIn' = 'true'
    ),
    earned as (
      select
        oi.id,
        oi.name,
        coalesce(oi.tier::text, 'bronze') as tier,
        oi.visit_count,
        coalesce(sum(lt.points) filter (where lt.type = 'earn'), 0)::int as points_earned
      from opted_in oi
      left join ${loyaltyTransactions} lt on lt.guest_id = oi.id
        and lt.restaurant_id = ${restaurantId}
        and lt.created_at >= ${startIso}
        and lt.created_at < ${endIso}
      group by oi.id, oi.name, oi.tier, oi.visit_count
    )
    select
      id as guest_id,
      name as guest_name,
      tier,
      visit_count,
      points_earned,
      rank() over (order by points_earned desc, visit_count desc, name asc)::int as rank
    from earned
    order by points_earned desc, visit_count desc, name asc
    limit ${Math.max(1, Math.min(limit, 100))}
  `)) as unknown as LeaderboardEntryRow[];
  },

  async countParticipants(restaurantId: string, executor: Executor = db): Promise<number> {
    const rows = (await executor.execute(sql`
    select count(*)::int as participant_count
    from ${guests}
    where restaurant_id = ${restaurantId}
      and preferences->'leaderboard'->>'optedIn' = 'true'
  `)) as unknown as Array<{ participant_count: number }>;
    return Number(rows[0]?.participant_count ?? 0);
  },
};
