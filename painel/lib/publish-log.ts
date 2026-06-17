import { promises as fs } from "node:fs";
import path from "node:path";
import { desc } from "drizzle-orm";
import { db } from "./db/client";
import { eventLog } from "./db/schema";

function resolveLogPath(): string {
  if (process.env.VERCEL) return "/tmp/publish.log";
  return path.resolve(process.cwd(), "publish.log");
}

export const LOG_PATH = resolveLogPath();

export type LogEvent = {
  ts: string;
  event:
    | "tick_start"
    | "tick_end"
    | "due"
    | "skip"
    | "publish_start"
    | "publish_ok"
    | "publish_fail"
    | "retry_scheduled"
    | "give_up";
  slug?: string;
  message?: string;
  account?: string;
  post_id?: string;
  attempt?: number;
};

export async function logEvent(event: Omit<LogEvent, "ts">): Promise<void> {
  const payload = { ts: new Date().toISOString(), ...event };
  const line = JSON.stringify(payload) + "\n";
  if (process.env.VERCEL) console.log("[publish-log]", line.trim());

  // file fallback (dev local + Vercel /tmp)
  try {
    await fs.appendFile(LOG_PATH, line, "utf8");
  } catch {
    // ignore: read-only or permission denied
  }

  // persistent DB log
  try {
    await db.insert(eventLog).values({
      event: event.event,
      slug: event.slug ?? null,
      message: event.message ?? null,
      account: event.account ?? null,
      postId: event.post_id ?? null,
      attempt: event.attempt ?? null,
    });
  } catch {
    // ignore: don't break ticks if DB is down
  }
}

export type LogRow = {
  id: string;
  ts: string;
  event: string;
  slug: string | null;
  message: string | null;
  account: string | null;
  attempt: number | null;
};

export async function readEventLog(limit = 200): Promise<LogRow[]> {
  try {
    const rows = await db
      .select({
        id: eventLog.id,
        ts: eventLog.ts,
        event: eventLog.event,
        slug: eventLog.slug,
        message: eventLog.message,
        account: eventLog.account,
        attempt: eventLog.attempt,
      })
      .from(eventLog)
      .orderBy(desc(eventLog.ts))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      ts: r.ts.toISOString(),
      event: r.event,
      slug: r.slug,
      message: r.message,
      account: r.account,
      attempt: r.attempt,
    }));
  } catch {
    return [];
  }
}
