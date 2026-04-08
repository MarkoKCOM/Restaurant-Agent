ALTER TABLE "reservations" ADD COLUMN "confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "seated_at" timestamp;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "no_show_at" timestamp;
