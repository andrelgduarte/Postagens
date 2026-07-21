import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== Todas as accounts (Instagram) — mais recentes ===");
  const all = await db.execute(sql`
    SELECT a.id, a.external_id, a.name, a.ig_user_id,
           LEFT(a.token, 20) AS token_preview,
           LENGTH(a.token) AS token_len,
           a.app_id IS NOT NULL AS has_app_id,
           a.app_secret IS NOT NULL AS has_app_secret,
           a.token_expires_at::text, a.graph_version,
           a.is_default, a.user_id, a.created_at::text
    FROM accounts a
    ORDER BY a.created_at DESC
    LIMIT 20
  `);
  for (const a of all.rows) console.log(a);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
