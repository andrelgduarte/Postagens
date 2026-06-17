import { sql } from "drizzle-orm";
import { db } from "../lib/db/client";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const candidates = await db.execute<{ post_id: string; slug: string; ig: string }>(sql`
    SELECT c_ig.post_id, p.slug, c_ig.content AS ig
    FROM captions c_ig
    JOIN posts p ON p.id = c_ig.post_id
    LEFT JOIN captions c_li
      ON c_li.post_id = c_ig.post_id AND c_li.network = 'li'
    WHERE c_ig.network = 'ig'
      AND length(trim(c_ig.content)) > 0
      AND (c_li.content IS NULL OR length(trim(c_li.content)) = 0)
  `);

  console.log(`${candidates.rows.length} post(s) com caption_ig preenchida e caption_li vazia.`);

  if (dryRun) {
    for (const row of candidates.rows.slice(0, 5)) {
      console.log(`  ${row.slug}: ${row.ig.slice(0, 60).replace(/\n/g, " ")}…`);
    }
    if (candidates.rows.length > 5) console.log(`  … +${candidates.rows.length - 5}`);
    process.exit(0);
  }

  for (const row of candidates.rows) {
    await db.execute(sql`
      INSERT INTO captions (post_id, network, content, updated_at)
      VALUES (${row.post_id}, 'li', ${row.ig}, now())
      ON CONFLICT (post_id, network)
      DO UPDATE SET content = EXCLUDED.content, updated_at = now()
    `);
    console.log(`  ✓ ${row.slug}`);
  }

  console.log(`\nOK: ${candidates.rows.length} caption(s) copiada(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
