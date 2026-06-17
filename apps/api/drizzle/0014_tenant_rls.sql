-- Phase 2a of centralized-tenant-scoping: Row-Level Security (VERIFY MODE).
--
-- RLS is ENABLED (not FORCED) on the tenant tables. The application connects as
-- the table OWNER (`openseat`), and a table owner bypasses RLS unless the table
-- is FORCEd — so these policies have NO effect on the running app yet. This is
-- the deliberate verify/permissive step: the machinery exists and is testable
-- with zero behavior change. Phase 2b adds FORCE ROW LEVEL SECURITY to flip it
-- fail-closed.
--
-- A session must SET LOCAL app.current_restaurant_id to either its restaurant's
-- UUID (sees only that restaurant's rows) or the nil-UUID bypass sentinel (sees
-- all rows; super_admin/system). nullif(..., '') maps an unset/empty setting to
-- NULL so the predicate is NULL/false and a FORCEd table denies all rows
-- (fail-closed) without a uuid cast error. DROP POLICY IF EXISTS makes the
-- migration safely re-runnable.

ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "campaigns";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "campaigns"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "challenges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "challenges";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "challenges"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "conversations";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "conversations"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "engagement_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "engagement_jobs";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "engagement_jobs"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "guests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "guests";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "guests"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "loyalty_transactions";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "loyalty_transactions"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "membership_processing_failures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "membership_processing_failures";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "membership_processing_failures"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "outbound_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "outbound_messages";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "outbound_messages"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "reservations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "reservations";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "reservations"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "reward_claims" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "reward_claims";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "reward_claims"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "rewards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "rewards";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "rewards"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "tables";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tables"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "visit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "visit_logs";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "visit_logs"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "waitlist" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "waitlist";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "waitlist"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR "restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE "challenge_progress" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation" ON "challenge_progress";
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "challenge_progress"
  FOR ALL
  USING (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR EXISTS (
        SELECT 1 FROM "challenges" c
        WHERE c."id" = "challenge_progress"."challenge_id"
          AND c."restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
      )
  )
  WITH CHECK (
    nullif(current_setting('app.current_restaurant_id', true), '')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
      OR EXISTS (
        SELECT 1 FROM "challenges" c
        WHERE c."id" = "challenge_progress"."challenge_id"
          AND c."restaurant_id" = nullif(current_setting('app.current_restaurant_id', true), '')::uuid
      )
  );
