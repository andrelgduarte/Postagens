import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";
async function main() {
  console.log("=== Posts do RECRUTOR (user_3FwldgMStLvJItpaUzHcPN98Wa5) julho/2026 ===");
  const posts = await db.execute(sql`
    SELECT slug, scheduled::text, status_ig, status_li, status_tt, status_th
    FROM posts
    WHERE user_id = 'user_3FwldgMStLvJItpaUzHcPN98Wa5'
      AND scheduled::date BETWEEN '2026-07-01' AND '2026-08-05'
    ORDER BY scheduled
    LIMIT 15
  `);
  for (const p of posts.rows) console.log(p);

  console.log("\n=== Contas conectadas do RECRUTOR ===");
  const igAcc = await db.execute(sql`
    SELECT name, is_default FROM accounts WHERE user_id = 'user_3FwldgMStLvJItpaUzHcPN98Wa5'
  `);
  console.log("IG:", igAcc.rows);
  const liAcc = await db.execute(sql`
    SELECT vanity_name, connected_at FROM linkedin_accounts WHERE user_id = 'user_3FwldgMStLvJItpaUzHcPN98Wa5'
  `);
  console.log("LI:", liAcc.rows);
  const thAcc = await db.execute(sql`
    SELECT username, connected_at FROM threads_accounts WHERE user_id = 'user_3FwldgMStLvJItpaUzHcPN98Wa5'
  `);
  console.log("TH:", thAcc.rows);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
