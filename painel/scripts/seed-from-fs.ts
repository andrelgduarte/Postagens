import { promises as fs } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import {
  accounts as accountsTable,
  appConfig,
  captions as captionsTable,
  insights as insightsTable,
  media as mediaTable,
  posts as postsTable,
} from "../lib/db/schema";
import { workerUserId } from "../lib/auth";

const USER_ID = workerUserId();

type LegacyConfig = {
  accounts?: {
    id: string;
    name: string;
    ig_user_id: string;
    token: string;
    graph_version?: string;
    is_default?: boolean;
  }[];
  defaults?: unknown;
  scheduler?: unknown;
  staging_dir?: string;
  notifications?: unknown;
};

type LegacyMeta = {
  scheduled?: string;
  status_ig?: string;
  status_li?: string;
  tags?: string[];
  ig_post_id?: string;
  type?: string;
  auto_publish?: boolean;
  account_id?: string;
  attempts?: number;
  last_attempt?: string;
  last_error?: string;
  published_at?: string;
};

type LegacyInsightFile = {
  snapshots?: {
    at: string;
    age_hours?: number;
    milestone: "24h" | "3d" | "7d";
    metrics?: { reach?: number; likes?: number; comments?: number; shares?: number; saved?: number };
  }[];
};

const PAINEL_DIR = path.resolve(process.cwd());
const POSTS_DIR = path.resolve(PAINEL_DIR, "..", "posts");
const CONFIG_JSON = path.join(PAINEL_DIR, "config.json");
const SLUG_RE = /^(\d{4}-\d{2}-\d{2})(?:-(.+))?$/;
const IMG_RE = /\.(jpe?g|png|webp)$/i;
const VID_RE = /\.(mp4|mov|m4v)$/i;
const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readText(file: string): Promise<string> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function seedConfig() {
  const config = await readJson<LegacyConfig>(CONFIG_JSON);
  if (!config) {
    console.log("config.json: ausente, pulando");
    return;
  }
  const accountsIn = config.accounts ?? [];
  for (const a of accountsIn) {
    const values = {
      userId: USER_ID,
      externalId: a.id,
      name: a.name,
      igUserId: a.ig_user_id,
      token: a.token,
      graphVersion: a.graph_version ?? null,
      isDefault: a.is_default ?? false,
      updatedAt: new Date(),
    };
    await db
      .insert(accountsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [accountsTable.userId, accountsTable.externalId],
        set: values,
      });
  }
  console.log(`config.json: ${accountsIn.length} conta(s) importada(s) para user=${USER_ID}`);

  const stored = {
    defaults: config.defaults,
    scheduler: config.scheduler,
    staging_dir: config.staging_dir,
    notifications: config.notifications,
  };
  await db
    .insert(appConfig)
    .values({ userId: USER_ID, key: "main", value: stored, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [appConfig.userId, appConfig.key],
      set: { value: stored, updatedAt: new Date() },
    });
}

function parseSlug(slug: string): { date: string; title: string } | null {
  const m = SLUG_RE.exec(slug);
  if (!m) return null;
  return {
    date: m[1],
    title: m[2]?.replace(/-/g, " ") ?? slug,
  };
}

async function accountUuidFor(externalId: string | undefined): Promise<string | null> {
  if (!externalId) return null;
  const rows = await db
    .select({ id: accountsTable.id })
    .from(accountsTable)
    .where(and(eq(accountsTable.userId, USER_ID), eq(accountsTable.externalId, externalId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function seedPost(slug: string) {
  const parsed = parseSlug(slug);
  if (!parsed) return null;
  const dir = path.join(POSTS_DIR, slug);
  const meta = (await readJson<LegacyMeta>(path.join(dir, "meta.json"))) ?? {};
  const captionIg = await readText(path.join(dir, "caption_ig.md"));
  const captionLi = await readText(path.join(dir, "caption_li.md"));
  const entries = await fs.readdir(dir);

  const mediaFiles = entries
    .filter((f) => IMG_RE.test(f) || VID_RE.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const accountUuid = await accountUuidFor(meta.account_id);
  const scheduled = meta.scheduled ? new Date(meta.scheduled) : null;

  const values = {
    userId: USER_ID,
    slug,
    date: parsed.date,
    title: parsed.title,
    type: (meta.type ?? "single") as "single" | "carousel" | "reel" | "story",
    scheduled: scheduled && !Number.isNaN(scheduled.getTime()) ? scheduled : null,
    statusIg: (meta.status_ig ?? "queued") as "queued" | "posted" | "skipped" | "failed",
    statusLi: (meta.status_li ?? "queued") as "queued" | "posted" | "skipped" | "failed",
    autoPublish: meta.auto_publish ?? false,
    accountId: accountUuid,
    igPostId: meta.ig_post_id ?? null,
    attempts: meta.attempts ?? 0,
    lastAttempt: meta.last_attempt ? new Date(meta.last_attempt) : null,
    lastError: meta.last_error ?? null,
    publishedAt: meta.published_at ? new Date(meta.published_at) : null,
    updatedAt: new Date(),
  };

  const [post] = await db
    .insert(postsTable)
    .values(values)
    .onConflictDoUpdate({ target: [postsTable.userId, postsTable.slug], set: values })
    .returning({ id: postsTable.id });

  await db
    .insert(captionsTable)
    .values([
      { postId: post.id, network: "ig", content: captionIg, updatedAt: new Date() },
      { postId: post.id, network: "li", content: captionLi, updatedAt: new Date() },
    ])
    .onConflictDoUpdate({
      target: [captionsTable.postId, captionsTable.network],
      set: { content: sqlExcluded("content"), updatedAt: new Date() },
    });

  await db.delete(mediaTable).where(eq(mediaTable.postId, post.id));
  if (mediaFiles.length > 0) {
    await db.insert(mediaTable).values(
      mediaFiles.map((f, idx) => {
        const ext = path.extname(f).toLowerCase();
        const kind: "image" | "video" = IMG_RE.test(f) ? "image" : "video";
        return {
          postId: post.id,
          kind,
          filename: f,
          sortOrder: idx,
          localPath: path.join(slug, f),
          contentType: CONTENT_TYPE[ext] ?? null,
        };
      })
    );
  }

  const insightsFile = await readJson<LegacyInsightFile>(path.join(dir, "insights.json"));
  if (insightsFile?.snapshots && insightsFile.snapshots.length > 0) {
    await db.delete(insightsTable).where(eq(insightsTable.postId, post.id));
    await db.insert(insightsTable).values(
      insightsFile.snapshots.map((s) => ({
        postId: post.id,
        milestone: s.milestone,
        capturedAt: new Date(s.at),
        ageHours: (s.age_hours ?? 0).toFixed(2),
        reach: s.metrics?.reach ?? null,
        likes: s.metrics?.likes ?? null,
        comments: s.metrics?.comments ?? null,
        shares: s.metrics?.shares ?? null,
        saved: s.metrics?.saved ?? null,
      }))
    );
  }

  return { slug, mediaCount: mediaFiles.length };
}

import { sql } from "drizzle-orm";
function sqlExcluded(col: string) {
  return sql.raw(`EXCLUDED.${col}`);
}

async function seedPosts() {
  let entries: string[];
  try {
    const dirents = await fs.readdir(POSTS_DIR, { withFileTypes: true });
    entries = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    console.log("posts/: ausente, pulando");
    return;
  }
  let ok = 0;
  let skipped = 0;
  for (const slug of entries) {
    const result = await seedPost(slug);
    if (result) {
      console.log(`  ✓ ${slug} (${result.mediaCount} mídias)`);
      ok += 1;
    } else {
      console.log(`  - ${slug} (slug inválido)`);
      skipped += 1;
    }
  }
  console.log(`posts/: ${ok} importado(s), ${skipped} pulado(s)`);
}

async function main() {
  console.log("seed start");
  await seedConfig();
  await seedPosts();
  console.log("seed ok");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
