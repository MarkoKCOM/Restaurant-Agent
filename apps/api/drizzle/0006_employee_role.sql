-- Add employee value to admin_role enum
ALTER TYPE "public"."admin_role" ADD VALUE IF NOT EXISTS 'employee';
