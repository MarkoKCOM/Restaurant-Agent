/**
 * Proves the Phase 2a Row-Level Security policies actually isolate tenants.
 *
 * The app connects as the table OWNER, who bypasses RLS unless a table is
 * FORCEd. So this script, inside a single transaction it always ROLLs BACK,
 * temporarily `FORCE`s RLS on the `tables` table (the Phase 2b config) and
 * asserts: a scoped session sees only its restaurant; the nil-UUID bypass sees
 * all; a non-matching/unset setting denies everything (fail-closed); and a
 * WITH CHECK violation blocks rewriting restaurant_id to escape the tenant.
 *
 * Run: `tsx scripts/rls-isolation-proof.ts` (needs DATABASE_URL).
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";
import { BYPASS_RESTAURANT_ID } from "../src/db/tenant-rls.js";

const NON_MATCH = "11111111-1111-1111-1111-111111111111";

let failures = 0;
function assert(name: string, cond: boolean, detail: string) {
  if (cond) {
    console.log(`  ✓ ${name} (${detail})`);
  } else {
    failures++;
    console.error(`  ✗ ${name} (${detail})`);
  }
}

async function main() {
  const restaurants = await db.execute<{ restaurant_id: string; n: number }>(
    sql`SELECT restaurant_id, count(*)::int AS n FROM tables GROUP BY restaurant_id HAVING count(*) > 0 ORDER BY n DESC LIMIT 2`,
  );
  const rows = restaurants as unknown as Array<{ restaurant_id: string; n: number }>;
  if (rows.length < 2) {
    console.error("Need ≥2 restaurants with rows in `tables` to prove isolation; found", rows.length);
    process.exit(2);
  }
  const [a, b] = rows;

  await db
    .transaction(async (tx) => {
      await tx.execute(sql`ALTER TABLE tables FORCE ROW LEVEL SECURITY`);

      const count = async (rid: string | null): Promise<{ total: number; leak: number }> => {
        if (rid === null) {
          await tx.execute(sql`RESET app.current_restaurant_id`);
        } else {
          await tx.execute(sql`SELECT set_config('app.current_restaurant_id', ${rid}, true)`);
        }
        const res = (await tx.execute<{ total: number; a_leak: number; b_leak: number }>(
          sql`SELECT count(*)::int AS total,
                     count(*) FILTER (WHERE restaurant_id <> ${a.restaurant_id})::int AS a_leak,
                     count(*) FILTER (WHERE restaurant_id <> ${b.restaurant_id})::int AS b_leak
              FROM tables`,
        )) as unknown as Array<{ total: number; a_leak: number; b_leak: number }>;
        const row = res[0];
        return { total: row.total, leak: rid === a.restaurant_id ? row.a_leak : row.b_leak };
      };

      const bypass = await count(BYPASS_RESTAURANT_ID);
      assert("bypass sees all rows", bypass.total >= a.n + b.n, `total=${bypass.total} >= A+B=${a.n + b.n}`);

      const scopedA = await count(a.restaurant_id);
      assert("scoped to A sees only A", scopedA.total === a.n && scopedA.leak === 0, `total=${scopedA.total} leak=${scopedA.leak}`);

      const scopedB = await count(b.restaurant_id);
      assert("scoped to B sees only B", scopedB.total === b.n && scopedB.leak === 0, `total=${scopedB.total} leak=${scopedB.leak}`);

      const nonMatch = await count(NON_MATCH);
      assert("non-matching uuid denies all", nonMatch.total === 0, `total=${nonMatch.total}`);

      const unset = await count(null);
      assert("unset setting is fail-closed", unset.total === 0, `total=${unset.total}`);

      // WITH CHECK: scoped to A, rewriting an A row's restaurant_id to B must fail.
      await tx.execute(sql`SELECT set_config('app.current_restaurant_id', ${a.restaurant_id}, true)`);
      let withCheckBlocked = false;
      try {
        await tx.execute(
          sql`UPDATE tables SET restaurant_id = ${b.restaurant_id} WHERE restaurant_id = ${a.restaurant_id}`,
        );
      } catch (e) {
        withCheckBlocked = /row-level security/i.test(e instanceof Error ? e.message : String(e));
      }
      assert("WITH CHECK blocks restaurant_id escape", withCheckBlocked, "update rejected");

      // Always roll back: never persist the FORCE or any write.
      throw new Error("__rollback__");
    })
    .catch((e) => {
      if (!(e instanceof Error) || e.message !== "__rollback__") throw e;
    });

  if (failures > 0) {
    console.error(`\nRLS isolation proof FAILED: ${failures} assertion(s)`);
    process.exit(1);
  }
  console.log("\nRLS isolation proof PASSED: tenants are isolated under FORCEd RLS");
  process.exit(0);
}

main().catch((err) => {
  console.error("RLS isolation proof error", err);
  process.exit(1);
});
