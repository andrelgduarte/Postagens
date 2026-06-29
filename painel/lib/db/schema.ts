import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().default("default-user"),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    igUserId: text("ig_user_id").notNull(),
    token: text("token").notNull(),
    appId: text("app_id"),
    appSecret: text("app_secret"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    graphVersion: text("graph_version"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("accounts_user_external_uq").on(t.userId, t.externalId)]
);

export const linkedinAccounts = pgTable(
  "linkedin_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().default("default-user"),
    personUrn: text("person_urn").notNull(),
    name: text("name").notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("linkedin_accounts_user_urn_uq").on(t.userId, t.personUrn)]
);

export const tiktokAccounts = pgTable(
  "tiktok_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().default("default-user"),
    openId: text("open_id").notNull(),
    unionId: text("union_id"),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("tiktok_accounts_user_open_uq").on(t.userId, t.openId)]
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().default("default-user"),
    slug: text("slug").notNull(),
    date: date("date").notNull(),
    title: text("title").notNull(),
    type: text("type").notNull().default("single"),
    scheduled: timestamp("scheduled", { withTimezone: false }),
    statusIg: text("status_ig").notNull().default("queued"),
    statusLi: text("status_li").notNull().default("queued"),
    statusTt: text("status_tt").notNull().default("queued"),
    autoPublish: boolean("auto_publish").notNull().default(false),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    igPostId: text("ig_post_id"),
    attempts: integer("attempts").notNull().default(0),
    lastAttempt: timestamp("last_attempt", { withTimezone: true }),
    lastError: text("last_error"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("posts_user_slug_uq").on(t.userId, t.slug),
    check("posts_type_chk", sql`${t.type} IN ('single','carousel','reel','story')`),
    check(
      "posts_status_ig_chk",
      sql`${t.statusIg} IN ('queued','posted','skipped','failed')`
    ),
    check(
      "posts_status_li_chk",
      sql`${t.statusLi} IN ('queued','posted','skipped','failed')`
    ),
    check(
      "posts_status_tt_chk",
      sql`${t.statusTt} IN ('queued','posted','skipped','failed')`
    ),
  ]
);

export const captions = pgTable(
  "captions",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    network: text("network").notNull(),
    content: text("content").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.network] }),
    check("captions_network_chk", sql`${t.network} IN ('ig','li','tt')`),
  ]
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    filename: text("filename").notNull(),
    sortOrder: integer("sort_order").notNull(),
    localPath: text("local_path"),
    blobUrl: text("blob_url"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    contentType: text("content_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("media_post_filename_uq").on(t.postId, t.filename),
    check("media_kind_chk", sql`${t.kind} IN ('image','video')`),
  ]
);

export const insights = pgTable(
  "insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    milestone: text("milestone").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    ageHours: numeric("age_hours", { precision: 8, scale: 2 }),
    reach: integer("reach"),
    likes: integer("likes"),
    comments: integer("comments"),
    shares: integer("shares"),
    saved: integer("saved"),
  },
  (t) => [
    unique("insights_post_milestone_uq").on(t.postId, t.milestone),
    check("insights_milestone_chk", sql`${t.milestone} IN ('24h','3d','7d')`),
  ]
);

export const eventLog = pgTable("event_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  event: text("event").notNull(),
  slug: text("slug"),
  message: text("message"),
  account: text("account"),
  postId: text("post_id"),
  attempt: integer("attempt"),
});

export const appConfig = pgTable(
  "app_config",
  {
    userId: text("user_id").notNull().default("default-user"),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })]
);

export type Account = typeof accounts.$inferSelect;
export type AccountInsert = typeof accounts.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type PostInsert = typeof posts.$inferInsert;
export type Caption = typeof captions.$inferSelect;
export type Media = typeof media.$inferSelect;
export type MediaInsert = typeof media.$inferInsert;
export type Insight = typeof insights.$inferSelect;
export type InsightInsert = typeof insights.$inferInsert;
export type AppConfigRow = typeof appConfig.$inferSelect;
export type LinkedinAccount = typeof linkedinAccounts.$inferSelect;
export type LinkedinAccountInsert = typeof linkedinAccounts.$inferInsert;
export type TiktokAccount = typeof tiktokAccounts.$inferSelect;
export type TiktokAccountInsert = typeof tiktokAccounts.$inferInsert;
