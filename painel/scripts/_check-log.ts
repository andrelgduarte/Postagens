import { db } from "../lib/db/client";
import { eventLog } from "../lib/db/schema";
import { desc } from "drizzle-orm";
async function main() {
  const rows = await db.select().from(eventLog).orderBy(desc(eventLog.ts)).limit(100);
  for (const r of rows) {
    const ts = r.ts.toISOString();
    console.log(ts, "|", r.event.padEnd(16), "|", (r.slug ?? "").padEnd(30), "|", (r.message ?? "").slice(0, 120));
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
