CREATE TABLE "threads_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text DEFAULT 'default-user' NOT NULL,
	"threads_user_id" text NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"access_token" text NOT NULL,
	"token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "threads_accounts_user_th_uq" UNIQUE("user_id","threads_user_id")
);
--> statement-breakpoint
ALTER TABLE "captions" DROP CONSTRAINT "captions_network_chk";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "status_th" text DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE "captions" ADD CONSTRAINT "captions_network_chk" CHECK ("captions"."network" IN ('ig','li','tt','th'));--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_status_th_chk" CHECK ("posts"."status_th" IN ('queued','posted','skipped','failed'));