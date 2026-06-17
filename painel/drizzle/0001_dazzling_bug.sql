ALTER TABLE "accounts" DROP CONSTRAINT "accounts_external_id_unique";--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_slug_unique";--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'app_config'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

ALTER TABLE "accounts" ADD COLUMN "user_id" text DEFAULT 'default-user' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_config" ADD COLUMN "user_id" text DEFAULT 'default-user' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_config" DROP CONSTRAINT "app_config_pkey";--> statement-breakpoint
ALTER TABLE "app_config" ADD CONSTRAINT "app_config_user_id_key_pk" PRIMARY KEY("user_id","key");--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "user_id" text DEFAULT 'default-user' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_external_uq" UNIQUE("user_id","external_id");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_slug_uq" UNIQUE("user_id","slug");