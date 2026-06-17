import { promises as fs } from "node:fs";
import path from "node:path";

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
  try {
    await fs.appendFile(LOG_PATH, line, "utf8");
  } catch {
    // best-effort: log file not writable (read-only FS, permissions, etc.)
  }
}

export async function readLog(limit = 200): Promise<LogEvent[]> {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf8");
    const lines = raw.trimEnd().split("\n").slice(-limit);
    return lines
      .map((l) => {
        try {
          return JSON.parse(l) as LogEvent;
        } catch {
          return null;
        }
      })
      .filter((e): e is LogEvent => e !== null);
  } catch {
    return [];
  }
}
