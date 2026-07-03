import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";
async function main() {
  const users = await db.execute<{ user_id: string; total: number }>(sql`
    SELECT user_id, COUNT(*)::int as total FROM posts GROUP BY user_id ORDER BY total DESC
  `);
  console.log("=== Users com posts ===");
  for (const u of users.rows) console.log(u);

  console.log("\n=== app_config.scheduler.enabled por usuário ===");
  const cfg = await db.execute<{ user_id: string; key: string; value: string }>(sql`
    SELECT user_id, key, value FROM app_config WHERE key LIKE 'scheduler%'
  `);
  for (const c of cfg.rows) console.log(c);

  console.log("\n=== Posts NÃO postados em 2026-07-02 por usuário/rede ===");
  const posts = await db.execute(sql`
    SELECT slug, user_id, scheduled_at::text, status_ig, status_li, status_tt, status_th
    FROM posts
    WHERE scheduled_at::date BETWEEN '2026-07-01' AND '2026-07-03'
    ORDER BY user_id, scheduled_at
  `);
  for (const p of posts.rows) console.log(p);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
