ALTER TABLE "rewards" ADD COLUMN "template_key" varchar(100);
--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "recommended_moments" jsonb;
--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "pitch_he" text;
--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "pitch_en" text;
