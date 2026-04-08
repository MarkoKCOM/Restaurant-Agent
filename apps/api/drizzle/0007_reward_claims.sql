CREATE TYPE "public"."reward_claim_status" AS ENUM('active', 'redeemed', 'expired', 'cancelled');

CREATE TABLE "reward_claims" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "guest_id" uuid NOT NULL,
  "reward_id" uuid NOT NULL,
  "loyalty_transaction_id" uuid,
  "claim_code" varchar(20) NOT NULL,
  "status" "reward_claim_status" DEFAULT 'active' NOT NULL,
  "claimed_at" timestamp DEFAULT now() NOT NULL,
  "redeemed_at" timestamp,
  "redeemed_by" uuid,
  "reservation_id" uuid,
  CONSTRAINT "reward_claims_claim_code_unique" UNIQUE("claim_code")
);

ALTER TABLE "reward_claims"
  ADD CONSTRAINT "reward_claims_restaurant_id_restaurants_id_fk"
    FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "reward_claims"
  ADD CONSTRAINT "reward_claims_guest_id_guests_id_fk"
    FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "reward_claims"
  ADD CONSTRAINT "reward_claims_reward_id_rewards_id_fk"
    FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "reward_claims"
  ADD CONSTRAINT "reward_claims_loyalty_transaction_id_loyalty_transactions_id_fk"
    FOREIGN KEY ("loyalty_transaction_id") REFERENCES "public"."loyalty_transactions"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "reward_claims"
  ADD CONSTRAINT "reward_claims_redeemed_by_admin_users_id_fk"
    FOREIGN KEY ("redeemed_by") REFERENCES "public"."admin_users"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "reward_claims"
  ADD CONSTRAINT "reward_claims_reservation_id_reservations_id_fk"
    FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
