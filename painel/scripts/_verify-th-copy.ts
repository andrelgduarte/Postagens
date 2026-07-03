import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";

const UID = "user_3FGh29qmsB3VcOGjO62SBGZZm15";

async function main() {
  const total = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE p.status_th = 'queued') AS queued,
      COUNT(*) FILTER (WHERE p.status_th = 'queued' AND cth.content IS NOT NULL AND cth.content <> '') AS queued_with_th,
      COUNT(*) FILTER (WHERE p.status_th = 'queued' AND (cth.content IS NULL OR cth.content = '')) AS queued_without_th
    FROM posts p
    LEFT JOIN captions cth ON cth.post_id = p.id AND cth.network = 'th'
    WHERE p.user_id = ${UID}
  `);
  console.log("=== TOTAIS (posts queued do Andre) ===");
  console.log(total.rows[0]);

  const sample = await db.execute(sql`
    SELECT p.slug, p.scheduled::date AS date,
           ci.content AS ig_content,
           cth.content AS th_content,
           (ci.content = cth.content) AS iguais
    FROM posts p
    JOIN captions ci ON ci.post_id = p.id AND ci.network = 'ig'
    LEFT JOIN captions cth ON cth.post_id = p.id AND cth.network = 'th'
    WHERE p.user_id = ${UID}
      AND p.status_th = 'queued'
    ORDER BY p.scheduled
    OFFSET FLOOR(RANDOM() * 20)::int
    LIMIT 3
  `);
  console.log("\n=== AMOSTRA (3 posts queued aleatorios) ===");
  for (const r of sample.rows) {
    console.log(`\n--- ${r.slug} (${r.date}) ---`);
    console.log(`iguais: ${r.iguais}`);
    console.log(`IG (${(r.ig_content as string).length} chars):\n${r.ig_content}`);
    console.log(`\nTH (${(r.th_content as string | null)?.length ?? 0} chars):\n${r.th_content}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
