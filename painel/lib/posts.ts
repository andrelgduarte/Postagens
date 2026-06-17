import { promises as fs } from "node:fs";
import path from "node:path";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "./db/client";
import {
  accounts as accountsTable,
  captions as captionsTable,
  insights as insightsTable,
  media as mediaTable,
  posts as postsTable,
} from "./db/schema";
import { currentUserId } from "./auth";
import { blobEnabled, uploadMediaBlob } from "./blob";
import { utcToZonedISO, zonedISOToUtc } from "./tz";

export const POSTS_DIR = path.resolve(process.cwd(), "..", "posts");

export type NetworkStatus = "queued" | "posted" | "skipped" | "failed";

export type PostType = "single" | "carousel" | "reel" | "story";

export type PostMeta = {
  scheduled?: string;
  status_ig: NetworkStatus;
  status_li: NetworkStatus;
  tags?: string[];
  ig_post_id?: string;
  type?: PostType;
  auto_publish?: boolean;
  account_id?: string;
  attempts?: number;
  last_attempt?: string;
  last_error?: string;
  published_at?: string;
};

export type Post = {
  slug: string;
  date: string;
  title: string;
  userId: string;
  images: string[];
  videos: string[];
  meta: PostMeta;
};

export type PostDetail = Post & {
  captionIg: string;
  captionLi: string;
};

const DEFAULT_META: PostMeta = {
  status_ig: "queued",
  status_li: "queued",
};

function toIso(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString() : undefined;
}

function toLocalSchedule(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return utcToZonedISO(d);
}

function parseScheduledForDb(s: string | undefined): Date | null {
  if (!s) return null;
  return zonedISOToUtc(s);
}

function parseTimestamp(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

type PostRow = typeof postsTable.$inferSelect;
type MediaRow = typeof mediaTable.$inferSelect;
type AccountRow = typeof accountsTable.$inferSelect;

function metaFromRow(
  row: PostRow,
  account: Pick<AccountRow, "externalId"> | null
): PostMeta {
  const meta: PostMeta = {
    ...DEFAULT_META,
    status_ig: row.statusIg as NetworkStatus,
    status_li: row.statusLi as NetworkStatus,
    type: row.type as PostType,
    auto_publish: row.autoPublish,
  };
  if (row.scheduled) meta.scheduled = toLocalSchedule(row.scheduled.toString());
  if (row.igPostId) meta.ig_post_id = row.igPostId;
  if (account) meta.account_id = account.externalId;
  if (row.attempts > 0) meta.attempts = row.attempts;
  if (row.lastAttempt) meta.last_attempt = toIso(row.lastAttempt);
  if (row.lastError) meta.last_error = row.lastError;
  if (row.publishedAt) meta.published_at = toIso(row.publishedAt);
  return meta;
}

async function resolveUserId(userId?: string): Promise<string> {
  return userId ?? (await currentUserId());
}

async function loadAccountByUuid(uuid: string | null): Promise<AccountRow | null> {
  if (!uuid) return null;
  const rows = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, uuid))
    .limit(1);
  return rows[0] ?? null;
}

async function loadAccountUuidByExternal(
  externalId: string,
  userId: string
): Promise<string | null> {
  const rows = await db
    .select({ id: accountsTable.id })
    .from(accountsTable)
    .where(and(eq(accountsTable.userId, userId), eq(accountsTable.externalId, externalId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

function splitMedia(rows: MediaRow[]): { images: string[]; videos: string[] } {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    images: sorted.filter((r) => r.kind === "image").map((r) => r.filename),
    videos: sorted.filter((r) => r.kind === "video").map((r) => r.filename),
  };
}

async function captionsByPost(postIds: string[]): Promise<Map<string, { ig: string; li: string }>> {
  const out = new Map<string, { ig: string; li: string }>();
  if (postIds.length === 0) return out;
  const rows = await db
    .select()
    .from(captionsTable)
    .where(inArray(captionsTable.postId, postIds));
  for (const id of postIds) out.set(id, { ig: "", li: "" });
  for (const r of rows) {
    const entry = out.get(r.postId)!;
    if (r.network === "ig") entry.ig = r.content;
    if (r.network === "li") entry.li = r.content;
  }
  return out;
}

async function mediaByPost(postIds: string[]): Promise<Map<string, MediaRow[]>> {
  const out = new Map<string, MediaRow[]>();
  if (postIds.length === 0) return out;
  const rows = await db.select().from(mediaTable).where(inArray(mediaTable.postId, postIds));
  for (const id of postIds) out.set(id, []);
  for (const r of rows) out.get(r.postId)!.push(r);
  return out;
}

async function accountsByUuid(uuids: string[]): Promise<Map<string, AccountRow>> {
  const out = new Map<string, AccountRow>();
  const ids = uuids.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return out;
  const rows = await db.select().from(accountsTable).where(inArray(accountsTable.id, ids));
  for (const r of rows) out.set(r.id, r);
  return out;
}

async function buildPosts(rows: PostRow[]): Promise<Post[]> {
  const postIds = rows.map((r) => r.id);
  const [mediaMap, acctMap] = await Promise.all([
    mediaByPost(postIds),
    accountsByUuid(rows.map((r) => r.accountId).filter((id): id is string => Boolean(id))),
  ]);
  const out: Post[] = [];
  for (const r of rows) {
    const account = r.accountId ? acctMap.get(r.accountId) ?? null : null;
    const split = splitMedia(mediaMap.get(r.id) ?? []);
    out.push({
      slug: r.slug,
      date: r.date,
      title: r.title,
      userId: r.userId,
      images: split.images,
      videos: split.videos,
      meta: metaFromRow(r, account),
    });
  }
  return out;
}

export async function listPosts(userId?: string): Promise<Post[]> {
  const uid = await resolveUserId(userId);
  const rows = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.userId, uid))
    .orderBy(asc(postsTable.date));
  return buildPosts(rows);
}

// Used by the scheduler worker — sees all users.
export async function listAllPosts(): Promise<Post[]> {
  const rows = await db.select().from(postsTable).orderBy(asc(postsTable.date));
  return buildPosts(rows);
}

export async function getPost(slug: string, userId?: string): Promise<PostDetail | null> {
  const uid = await resolveUserId(userId);
  const rows = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.userId, uid), eq(postsTable.slug, slug)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const [mediaRows, capMap, account] = await Promise.all([
    mediaByPost([row.id]).then((m) => m.get(row.id) ?? []),
    captionsByPost([row.id]).then((c) => c.get(row.id) ?? { ig: "", li: "" }),
    loadAccountByUuid(row.accountId),
  ]);
  const split = splitMedia(mediaRows);
  return {
    slug: row.slug,
    date: row.date,
    title: row.title,
    userId: row.userId,
    images: split.images,
    videos: split.videos,
    meta: metaFromRow(row, account),
    captionIg: capMap.ig,
    captionLi: capMap.li,
  };
}

// Scheduler worker uses this to load any post regardless of owner.
export async function getPostBySlugGlobal(slug: string): Promise<PostDetail | null> {
  const rows = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const [mediaRows, capMap, account] = await Promise.all([
    mediaByPost([row.id]).then((m) => m.get(row.id) ?? []),
    captionsByPost([row.id]).then((c) => c.get(row.id) ?? { ig: "", li: "" }),
    loadAccountByUuid(row.accountId),
  ]);
  const split = splitMedia(mediaRows);
  return {
    slug: row.slug,
    date: row.date,
    title: row.title,
    userId: row.userId,
    images: split.images,
    videos: split.videos,
    meta: metaFromRow(row, account),
    captionIg: capMap.ig,
    captionLi: capMap.li,
  };
}

export async function writeMeta(slug: string, meta: PostMeta, userId?: string): Promise<void> {
  const uid = await resolveUserId(userId);
  const accountUuid = meta.account_id
    ? await loadAccountUuidByExternal(meta.account_id, uid)
    : null;
  await db
    .update(postsTable)
    .set({
      scheduled: parseScheduledForDb(meta.scheduled),
      statusIg: meta.status_ig,
      statusLi: meta.status_li,
      type: (meta.type ?? "single") as PostType,
      autoPublish: meta.auto_publish ?? false,
      accountId: accountUuid,
      igPostId: meta.ig_post_id ?? null,
      attempts: meta.attempts ?? 0,
      lastAttempt: parseTimestamp(meta.last_attempt),
      lastError: meta.last_error ?? null,
      publishedAt: parseTimestamp(meta.published_at),
      updatedAt: new Date(),
    })
    .where(and(eq(postsTable.userId, uid), eq(postsTable.slug, slug)));
}

// Variant for the scheduler worker: writes meta for whatever user owns the post.
export async function writeMetaGlobal(slug: string, meta: PostMeta): Promise<void> {
  const rows = await db
    .select({ id: postsTable.id, userId: postsTable.userId })
    .from(postsTable)
    .where(eq(postsTable.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`Post ${slug} não encontrado`);
  const accountUuid = meta.account_id
    ? await loadAccountUuidByExternal(meta.account_id, row.userId)
    : null;
  await db
    .update(postsTable)
    .set({
      scheduled: parseScheduledForDb(meta.scheduled),
      statusIg: meta.status_ig,
      statusLi: meta.status_li,
      type: (meta.type ?? "single") as PostType,
      autoPublish: meta.auto_publish ?? false,
      accountId: accountUuid,
      igPostId: meta.ig_post_id ?? null,
      attempts: meta.attempts ?? 0,
      lastAttempt: parseTimestamp(meta.last_attempt),
      lastError: meta.last_error ?? null,
      publishedAt: parseTimestamp(meta.published_at),
      updatedAt: new Date(),
    })
    .where(eq(postsTable.id, row.id));
}

export async function writeCaption(
  slug: string,
  network: "ig" | "li",
  content: string,
  userId?: string
): Promise<void> {
  const uid = await resolveUserId(userId);
  const post = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.userId, uid), eq(postsTable.slug, slug)))
    .limit(1);
  if (!post[0]) throw new Error(`Post ${slug} não encontrado`);
  const values = { postId: post[0].id, network, content, updatedAt: new Date() };
  await db
    .insert(captionsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [captionsTable.postId, captionsTable.network],
      set: { content, updatedAt: new Date() },
    });
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function nextAvailableSlug(base: string, userId: string): Promise<string> {
  let slug = base;
  let n = 1;
  while (await slugExists(slug, userId)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

async function slugExists(slug: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.userId, userId), eq(postsTable.slug, slug)))
    .limit(1);
  return rows.length > 0;
}

const IMG_EXT_RE = /\.(jpe?g|png|webp)$/i;
const VID_EXT_RE = /\.(mp4|mov|m4v)$/i;

function classify(filename: string): "image" | "video" | null {
  if (IMG_EXT_RE.test(filename)) return "image";
  if (VID_EXT_RE.test(filename)) return "video";
  return null;
}

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

export async function createPost(opts: {
  date: string;
  title: string;
  images: { name: string; buffer: Buffer }[];
  type?: PostType;
  auto_publish?: boolean;
  account_id?: string;
  userId?: string;
}): Promise<string> {
  const uid = await resolveUserId(opts.userId);
  const useBlob = blobEnabled();
  const slugBase = `${opts.date}-${slugify(opts.title) || "post"}`;
  let slug = slugBase;
  let n = 1;
  while (await slugExists(slug, uid)) {
    n += 1;
    slug = `${slugBase}-${n}`;
  }

  const dir = path.join(POSTS_DIR, slug);
  if (!useBlob) {
    await fs.mkdir(POSTS_DIR, { recursive: true });
    await fs.mkdir(dir, { recursive: true });
  }

  const sorted = [...opts.images].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );
  const written: {
    kind: "image" | "video";
    filename: string;
    size: number;
    ext: string;
    buffer: Buffer;
  }[] = [];
  for (const [idx, item] of sorted.entries()) {
    const kind = classify(item.name);
    if (!kind) continue;
    const ext = path.extname(item.name).toLowerCase() || ".jpg";
    const filename = `${String(idx + 1).padStart(2, "0")}${ext}`;
    if (!useBlob) {
      await fs.writeFile(path.join(dir, filename), item.buffer);
    }
    written.push({ kind, filename, size: item.buffer.length, ext, buffer: item.buffer });
  }

  const accountUuid = opts.account_id
    ? await loadAccountUuidByExternal(opts.account_id, uid)
    : null;
  const type: PostType =
    opts.type ?? (written.filter((w) => w.kind === "image").length >= 2 ? "carousel" : "single");

  const [inserted] = await db
    .insert(postsTable)
    .values({
      userId: uid,
      slug,
      date: opts.date,
      title: opts.title,
      type,
      autoPublish: opts.auto_publish ?? false,
      accountId: accountUuid,
    })
    .returning({ id: postsTable.id });

  await db.insert(captionsTable).values([
    { postId: inserted.id, network: "ig", content: "" },
    { postId: inserted.id, network: "li", content: "" },
  ]);

  if (written.length > 0) {
    const blobUrls: (string | null)[] = useBlob
      ? await Promise.all(
          written.map(async (w) => {
            const { url } = await uploadMediaBlob({
              userId: uid,
              slug,
              filename: w.filename,
              buffer: w.buffer,
              contentType: CONTENT_TYPE[w.ext],
            });
            return url;
          })
        )
      : written.map(() => null);

    await db.insert(mediaTable).values(
      written.map((w, idx) => ({
        postId: inserted.id,
        kind: w.kind,
        filename: w.filename,
        sortOrder: idx,
        localPath: useBlob ? null : path.join(slug, w.filename),
        blobUrl: blobUrls[idx],
        sizeBytes: w.size,
        contentType: CONTENT_TYPE[w.ext] ?? null,
      }))
    );
  }

  return slug;
}

export function imageUrl(slug: string, filename: string): string {
  return `/api/img/${encodeURIComponent(slug)}/${encodeURIComponent(filename)}`;
}

export async function deletePostBySlug(slug: string, userId?: string): Promise<boolean> {
  const uid = await resolveUserId(userId);
  const rows = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.userId, uid), eq(postsTable.slug, slug)))
    .limit(1);
  const row = rows[0];
  if (!row) return false;

  // best-effort blob cleanup
  const mediaRows = await db
    .select({ blobUrl: mediaTable.blobUrl })
    .from(mediaTable)
    .where(eq(mediaTable.postId, row.id));
  const { deleteMediaBlob } = await import("./blob");
  await Promise.allSettled(
    mediaRows
      .filter((m): m is { blobUrl: string } => Boolean(m.blobUrl))
      .map((m) => deleteMediaBlob(m.blobUrl))
  );

  await db.delete(postsTable).where(eq(postsTable.id, row.id));
  return true;
}

export async function getPostId(slug: string, userId?: string): Promise<string | null> {
  const uid = await resolveUserId(userId);
  const rows = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.userId, uid), eq(postsTable.slug, slug)))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function getPostIdGlobal(slug: string): Promise<string | null> {
  const rows = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(eq(postsTable.slug, slug))
    .limit(1);
  return rows[0]?.id ?? null;
}

export { insightsTable, mediaTable, postsTable };
