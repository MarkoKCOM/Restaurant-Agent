-- Add admin_role enum and role column, make restaurant_id nullable for super admins
CREATE TYPE "public"."admin_role" AS ENUM('admin', 'super_admin');--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "role" "admin_role" DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "restaurant_id" DROP NOT NULL;
