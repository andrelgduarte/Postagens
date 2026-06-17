import { asc, eq, inArray } from "drizzle-orm";
import { db } from "./db/client";
import { insights as insightsTable, posts as postsTable } from "./db/schema";
import { getPostId, getPostIdGlobal, listPosts, listAllPosts } from "./posts";
import { getAccount } from "./config";
import { logEvent } from "./publish-log";

const GRAPH_BASE = "https://graph.facebook.com";
const METRICS = ["reach", "likes", "comments", "shares", "saved"] as const;

export type Milestone = "24h" | "3d" | "7d";

export type InsightMetrics = {
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saved?: number;
};

export type InsightSnapshot = {
  at: string;
  age_hours: number;
  milestone: Milestone;
  metrics: InsightMetrics;
};

export type Insights = {
  snapshots: InsightSnapshot[];
};

const MILESTONE_MIN_HOURS: Record<Milestone, number> = {
  "24h": 22,
  "3d": 70,
  "7d": 166,
};

const MILESTONE_ORDER: Milestone[] = ["24h", "3d", "7d"];

type InsightRow = typeof insightsTable.$inferSelect;

function rowToSnapshot(row: InsightRow): InsightSnapshot {
  return {
    at: row.capturedAt.toISOString(),
    age_hours: row.ageHours ? Number(row.ageHours) : 0,
    milestone: row.milestone as Milestone,
    metrics: {
      reach: row.reach ?? undefined,
      likes: row.likes ?? undefined,
      comments: row.comments ?? undefined,
      shares: row.shares ?? undefined,
      saved: row.saved ?? undefined,
    },
  };
}

export async function readInsights(slug: string, userId?: string): Promise<Insights> {
  const postId = userId
    ? await getPostId(slug, userId)
    : await (async () => {
        try {
          return await getPostId(slug);
        } catch {
          return await getPostIdGlobal(slug);
        }
      })();
  if (!postId) return { snapshots: [] };
  const rows = await db
    .select()
    .from(insightsTable)
    .where(eq(insightsTable.postId, postId))
    .orderBy(asc(insightsTable.capturedAt));
  return { snapshots: rows.map(rowToSnapshot) };
}

export async function upsertSnapshotGlobal(slug: string, snapshot: InsightSnapshot): Promise<void> {
  const postId = await getPostIdGlobal(slug);
  if (!postId) throw new Error(`Post ${slug} não encontrado`);
  const values = {
    postId,
    milestone: snapshot.milestone,
    capturedAt: new Date(snapshot.at),
    ageHours: snapshot.age_hours.toFixed(2),
    reach: snapshot.metrics.reach ?? null,
    likes: snapshot.metrics.likes ?? null,
    comments: snapshot.metrics.comments ?? null,
    shares: snapshot.metrics.shares ?? null,
    saved: snapshot.metrics.saved ?? null,
  };
  await db
    .insert(insightsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [insightsTable.postId, insightsTable.milestone],
      set: values,
    });
}

export function ageHours(publishedAt: string, now: Date): number {
  const t = new Date(publishedAt).getTime();
  return (now.getTime() - t) / 3_600_000;
}

export function nextMilestone(insights: Insights, ageH: number): Milestone | null {
  const taken = new Set(insights.snapshots.map((s) => s.milestone));
  for (const m of MILESTONE_ORDER) {
    if (taken.has(m)) continue;
    if (ageH >= MILESTONE_MIN_HOURS[m]) return m;
    return null;
  }
  return null;
}

type GraphInsightsResponse = {
  data?: { name: string; values?: { value?: number }[] }[];
  error?: { message?: string };
};

export async function fetchInsights(
  igMediaId: string,
  token: string,
  version: string
): Promise<InsightMetrics> {
  const url = `${GRAPH_BASE}/${version}/${igMediaId}/insights?metric=${METRICS.join(",")}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = (await res.json()) as GraphInsightsResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Graph ${res.status} em insights`);
  }
  const out: InsightMetrics = {};
  for (const item of data.data ?? []) {
    const v = item.values?.[0]?.value;
    if (typeof v === "number" && METRICS.includes(item.name as (typeof METRICS)[number])) {
      out[item.name as keyof InsightMetrics] = v;
    }
  }
  return out;
}

export type CollectResult = {
  slug: string;
  milestone?: Milestone;
  ok: boolean;
  reason?: string;
};

export async function collectInsightsTick(now: Date): Promise<CollectResult[]> {
  const posts = await listAllPosts();
  const out: CollectResult[] = [];
  for (const p of posts) {
    const m = p.meta;
    if (m.status_ig !== "posted") continue;
    if (!m.ig_post_id || !m.published_at) continue;
    const ageH = ageHours(m.published_at, now);
    const existing = await readInsights(p.slug, p.userId);
    const ms = nextMilestone(existing, ageH);
    if (!ms) continue;
    try {
      const account = await getAccount(m.account_id, p.userId);
      const metrics = await fetchInsights(
        m.ig_post_id,
        account.token,
        account.graph_version ?? "v22.0"
      );
      await upsertSnapshotGlobal(p.slug, {
        at: now.toISOString(),
        age_hours: Math.round(ageH * 10) / 10,
        milestone: ms,
        metrics,
      });
      await logEvent({ event: "publish_ok", slug: p.slug, message: `insights ${ms}` });
      out.push({ slug: p.slug, milestone: ms, ok: true });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      await logEvent({ event: "publish_fail", slug: p.slug, message: `insights ${ms}: ${reason}` });
      out.push({ slug: p.slug, milestone: ms, ok: false, reason });
    }
  }
  return out;
}

export type PostInsightsSummary = {
  slug: string;
  date: string;
  title: string;
  type?: string;
  last?: InsightSnapshot;
  snapshots: number;
};

export async function summarizeAll(userId?: string): Promise<PostInsightsSummary[]> {
  const posts = await listPosts(userId);
  const postedSlugs = posts.filter((p) => p.meta.status_ig === "posted");
  if (postedSlugs.length === 0) return [];
  const postIdRows = await db
    .select({ id: postsTable.id, slug: postsTable.slug })
    .from(postsTable)
    .where(inArray(postsTable.slug, postedSlugs.map((p) => p.slug)));
  const idToSlug = new Map(postIdRows.map((r) => [r.id, r.slug]));
  const insightRows = await db
    .select()
    .from(insightsTable)
    .where(inArray(insightsTable.postId, postIdRows.map((r) => r.id)))
    .orderBy(asc(insightsTable.capturedAt));
  const bySlug = new Map<string, InsightRow[]>();
  for (const r of insightRows) {
    const slug = idToSlug.get(r.postId);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug)!.push(r);
  }

  const out: PostInsightsSummary[] = [];
  for (const p of postedSlugs) {
    const rows = bySlug.get(p.slug) ?? [];
    const last = rows[rows.length - 1];
    out.push({
      slug: p.slug,
      date: p.date,
      title: p.title,
      type: p.meta.type,
      last: last ? rowToSnapshot(last) : undefined,
      snapshots: rows.length,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function engagement(m?: InsightMetrics): number {
  if (!m) return 0;
  return (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saved ?? 0);
}
