import { promises as fs } from "node:fs";
import path from "node:path";
import { POSTS_DIR, listPosts } from "./posts";
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

export function insightsPath(slug: string): string {
  return path.join(POSTS_DIR, slug, "insights.json");
}

export async function readInsights(slug: string): Promise<Insights> {
  try {
    const raw = await fs.readFile(insightsPath(slug), "utf8");
    return JSON.parse(raw) as Insights;
  } catch {
    return { snapshots: [] };
  }
}

export async function writeInsights(slug: string, data: Insights): Promise<void> {
  await fs.writeFile(insightsPath(slug), JSON.stringify(data, null, 2) + "\n", "utf8");
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
  const posts = await listPosts();
  const out: CollectResult[] = [];
  for (const p of posts) {
    const m = p.meta;
    if (m.status_ig !== "posted") continue;
    if (!m.ig_post_id || !m.published_at) continue;
    const ageH = ageHours(m.published_at, now);
    const existing = await readInsights(p.slug);
    const ms = nextMilestone(existing, ageH);
    if (!ms) continue;
    try {
      const account = await getAccount(m.account_id);
      const metrics = await fetchInsights(
        m.ig_post_id,
        account.token,
        account.graph_version ?? "v22.0"
      );
      existing.snapshots.push({
        at: now.toISOString(),
        age_hours: Math.round(ageH * 10) / 10,
        milestone: ms,
        metrics,
      });
      await writeInsights(p.slug, existing);
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

export async function summarizeAll(): Promise<PostInsightsSummary[]> {
  const posts = await listPosts();
  const out: PostInsightsSummary[] = [];
  for (const p of posts) {
    if (p.meta.status_ig !== "posted") continue;
    const ins = await readInsights(p.slug);
    out.push({
      slug: p.slug,
      date: p.date,
      title: p.title,
      type: p.meta.type,
      last: ins.snapshots[ins.snapshots.length - 1],
      snapshots: ins.snapshots.length,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export function engagement(m?: InsightMetrics): number {
  if (!m) return 0;
  return (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saved ?? 0);
}
