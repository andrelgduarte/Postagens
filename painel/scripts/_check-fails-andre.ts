import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";

const ANDRE = "user_3FGh29qmsB3VcOGjO62SBGZZm15";

async function main() {
  console.log("=== status atual dos posts do Andre nos últimos 15 dias ===");
  const posts = await db.execute(sql`
    SELECT slug, scheduled::text, status_ig, status_li, status_tt, status_th,
           attempts, last_error, last_attempt::text, published_at::text
    FROM posts
    WHERE user_id = ${ANDRE}
      AND scheduled::date BETWEEN CURRENT_DATE - INTERVAL '15 days' AND CURRENT_DATE + INTERVAL '3 days'
    ORDER BY scheduled DESC
  `);
  for (const p of posts.rows) console.log(p);

  console.log("\n=== posts do Andre com QUALQUER status = 'failed' (todo o histórico) ===");
  const failedPosts = await db.execute(sql`
    SELECT slug, scheduled::text, status_ig, status_li, status_tt, status_th,
           attempts, last_error, last_attempt::text
    FROM posts
    WHERE user_id = ${ANDRE}
      AND ('failed' IN (status_ig, status_li, status_tt, status_th))
    ORDER BY scheduled DESC
    LIMIT 50
  `);
  for (const p of failedPosts.rows) console.log(p);

  const slugs = (posts.rows as Array<{ slug: string }>).map((r) => r.slug);
  const failSlugs = (failedPosts.rows as Array<{ slug: string }>).map((r) => r.slug);
  const allSlugs = Array.from(new Set([...slugs, ...failSlugs]));

  if (allSlugs.length > 0) {
    const csvSlugs = allSlugs.map((s) => `'${s.replace(/'/g, "''")}'`).join(",");
    console.log("\n=== events (fail/retry/give_up/skip) por slug do Andre — 60 mais recentes ===");
    const evts = await db.execute(sql.raw(`
      SELECT ts::text, event, slug, account, attempt, LEFT(COALESCE(message,''), 250) AS message
      FROM event_log
      WHERE slug IN (${csvSlugs})
        AND event IN ('publish_fail','give_up','retry_scheduled','skip')
      ORDER BY ts DESC
      LIMIT 60
    `));
    for (const r of evts.rows) console.log(r);

    console.log("\n=== agregação: quantas falhas por account nas últimas 14 dias ===");
    const agg = await db.execute(sql.raw(`
      SELECT account, COUNT(*)::int AS qtd, MAX(ts)::text AS ultimo
      FROM event_log
      WHERE slug IN (${csvSlugs})
        AND event = 'publish_fail'
        AND ts >= NOW() - INTERVAL '14 days'
      GROUP BY account
      ORDER BY qtd DESC
    `));
    for (const r of agg.rows) console.log(r);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
