CREATE TABLE IF NOT EXISTS "outbound_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "guest_id" uuid,
  "channel" varchar(30) DEFAULT 'whatsapp' NOT NULL,
  "provider" varchar(50) DEFAULT 'debug_log' NOT NULL,
  "recipient_masked" varchar(40),
  "message_type" varchar(60) NOT NULL,
  "message_category" varchar(20) DEFAULT 'transactional' NOT NULL,
  "subject_type" varchar(60),
  "subject_id" uuid,
  "status" varchar(30) DEFAULT 'logged' NOT NULL,
  "text_preview" text NOT NULL,
  "payload" jsonb,
  "error_code" varchar(100),
  "error_message" text,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_messages_restaurant_created_idx" ON "outbound_messages" ("restaurant_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_messages_status_created_idx" ON "outbound_messages" ("status", "created_at");
