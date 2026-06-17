CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"ig_user_id" text NOT NULL,
	"token" text NOT NULL,
	"graph_version" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "captions" (
	"post_id" uuid NOT NULL,
	"network" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "captions_post_id_network_pk" PRIMARY KEY("post_id","network"),
	CONSTRAINT "captions_network_chk" CHECK ("captions"."network" IN ('ig','li'))
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"milestone" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"age_hours" numeric(8, 2),
	"reach" integer,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"saved" integer,
	CONSTRAINT "insights_post_milestone_uq" UNIQUE("post_id","milestone"),
	CONSTRAINT "insights_milestone_chk" CHECK ("insights"."milestone" IN ('24h','3d','7d'))
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"filename" text NOT NULL,
	"sort_order" integer NOT NULL,
	"local_path" text,
	"blob_url" text,
	"size_bytes" bigint,
	"content_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_post_filename_uq" UNIQUE("post_id","filename"),
	CONSTRAINT "media_kind_chk" CHECK ("media"."kind" IN ('image','video'))
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'single' NOT NULL,
	"scheduled" timestamp,
	"status_ig" text DEFAULT 'queued' NOT NULL,
	"status_li" text DEFAULT 'queued' NOT NULL,
	"auto_publish" boolean DEFAULT false NOT NULL,
	"account_id" uuid,
	"ig_post_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt" timestamp with time zone,
	"last_error" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "posts_type_chk" CHECK ("posts"."type" IN ('single','carousel','reel','story')),
	CONSTRAINT "posts_status_ig_chk" CHECK ("posts"."status_ig" IN ('queued','posted','skipped','failed')),
	CONSTRAINT "posts_status_li_chk" CHECK ("posts"."status_li" IN ('queued','posted','skipped','failed'))
);
--> statement-breakpoint
ALTER TABLE "captions" ADD CONSTRAINT "captions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;