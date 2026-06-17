import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const p = await db.execute(sql`SELECT COUNT(*) AS n FROM posts`);
  const m = await db.execute(sql`SELECT COUNT(*) AS n FROM media WHERE blob_url IS NOT NULL`);
  const dates = await db.execute(sql`SELECT MIN(date) AS first, MAX(date) AS last FROM posts`);
  const auto = await db.execute(sql`SELECT COUNT(*) AS n FROM posts WHERE auto_publish = true`);
  const today = await db.execute(sql`SELECT slug, auto_publish, status_ig, scheduled, account_id, attempts, last_error FROM posts WHERE date = '2026-06-17' ORDER BY scheduled`);
  const accounts = await db.execute(sql`SELECT id, external_id, name, is_default, user_id FROM accounts`);
  const noAccount = await db.execute(sql`SELECT COUNT(*) AS n FROM posts WHERE account_id IS NULL AND auto_publish = true`);
  const cfg = await db.execute(sql`SELECT key, value::text AS value FROM app_config`);
  console.log({
    posts: p.rows[0],
    media_with_blob: m.rows[0],
    date_range: dates.rows[0],
    auto_publish: auto.rows[0],
    today: today.rows,
    config: cfg.rows,
    accounts: accounts.rows,
    auto_publish_without_account: noAccount.rows[0],
  });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
