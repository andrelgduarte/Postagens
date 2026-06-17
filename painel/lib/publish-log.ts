import { promises as fs } from "node:fs";
import path from "node:path";

export const LOG_PATH = path.resolve(process.cwd(), "publish.log");

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
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n";
  await fs.appendFile(LOG_PATH, line, "utf8");
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
