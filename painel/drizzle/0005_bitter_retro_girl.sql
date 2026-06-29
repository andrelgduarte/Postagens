CREATE TABLE "tiktok_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text DEFAULT 'default-user' NOT NULL,
	"open_id" text NOT NULL,
	"union_id" text,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tiktok_accounts_user_open_uq" UNIQUE("user_id","open_id")
);
--> statement-breakpoint
ALTER TABLE "captions" DROP CONSTRAINT "captions_network_chk";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "status_tt" text DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE "captions" ADD CONSTRAINT "captions_network_chk" CHECK ("captions"."network" IN ('ig','li','tt'));--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_status_tt_chk" CHECK ("posts"."status_tt" IN ('queued','posted','skipped','failed'));