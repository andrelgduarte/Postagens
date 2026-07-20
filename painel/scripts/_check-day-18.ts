import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";
async function main() {
  console.log("=== 18/07 posts do Andre ===");
  const r = await db.execute(sql`
    SELECT slug, scheduled::text, auto_publish, status_ig, status_li, status_tt, status_th,
           attempts, last_attempt::text, account_id
    FROM posts
    WHERE user_id = 'user_3FGh29qmsB3VcOGjO62SBGZZm15'
      AND scheduled::date BETWEEN '2026-07-17' AND '2026-07-22'
    ORDER BY scheduled
  `);
  for (const x of r.rows) console.log(x);

  console.log("\n=== app_config do Andre ===");
  const cfg = await db.execute(sql`
    SELECT key, value FROM app_config WHERE user_id = 'user_3FGh29qmsB3VcOGjO62SBGZZm15'
  `);
  for (const x of cfg.rows) console.log(x);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
