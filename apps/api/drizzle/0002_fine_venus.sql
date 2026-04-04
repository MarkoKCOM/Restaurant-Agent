CREATE TYPE "public"."feedback_channel" AS ENUM('whatsapp', 'web', 'sms');--> statement-breakpoint
CREATE TABLE "visit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"reservation_id" uuid,
	"date" date NOT NULL,
	"party_size" integer,
	"items" jsonb,
	"total_spend" integer,
	"feedback" text,
	"rating" integer,
	"sentiment" text,
	"staff_notes" text,
	"occasion" text,
	"dietary_notes" jsonb,
	"channel" "feedback_channel",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;