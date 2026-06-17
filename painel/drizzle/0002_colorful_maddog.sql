ALTER TABLE "accounts" ADD COLUMN "app_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "app_secret" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "token_expires_at" timestamp with time zone;