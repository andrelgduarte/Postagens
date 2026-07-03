import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";
async function main() {
  const cfg = await db.execute(sql`SELECT user_id, key, value FROM app_config ORDER BY user_id, key`);
  console.log("=== app_config (todas as linhas) ===");
  for (const c of cfg.rows) console.log(c);

  console.log("\n=== Posts do usuário recrutor (user_3FGh29qmsB3VcOGjO62SBGZZm15) em jul/2026 ===");
  const posts = await db.execute(sql`
    SELECT slug, scheduled::text, status_ig, status_li, status_tt, status_th
    FROM posts
    WHERE user_id = 'user_3FGh29qmsB3VcOGjO62SBGZZm15'
      AND scheduled::date BETWEEN '2026-07-01' AND '2026-07-05'
    ORDER BY scheduled
  `);
  for (const p of posts.rows) console.log(p);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
