CREATE TABLE "event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"event" text NOT NULL,
	"slug" text,
	"message" text,
	"account" text,
	"post_id" text,
	"attempt" integer
);
