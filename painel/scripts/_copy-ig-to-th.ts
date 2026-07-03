import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";

const UID = "user_3FGh29qmsB3VcOGjO62SBGZZm15";

async function main() {
  const apply = process.argv.includes("--apply");

  const preview = await db.execute(sql`
    SELECT p.slug,
           p.status_th,
           LENGTH(ci.content) AS ig_len,
           COALESCE(LENGTH(cth.content), 0) AS th_len,
           CASE WHEN cth.post_id IS NULL THEN 'INSERT' ELSE 'UPDATE' END AS action,
           LEFT(ci.content, 80) AS ig_preview
    FROM posts p
    JOIN captions ci ON ci.post_id = p.id AND ci.network = 'ig'
    LEFT JOIN captions cth ON cth.post_id = p.id AND cth.network = 'th'
    WHERE p.user_id = ${UID}
      AND p.status_th = 'queued'
      AND ci.content <> ''
      AND (cth.post_id IS NULL OR cth.content = '')
    ORDER BY p.scheduled
  `);

  console.log(`\n=== Posts que ganhariam legenda TH copiada do IG (${preview.rows.length}) ===`);
  for (const r of preview.rows) console.log(r);

  if (!apply) {
    console.log("\n(dry-run) rode com --apply para gravar.");
    return;
  }

  const upd = await db.execute(sql`
    INSERT INTO captions (post_id, network, content, updated_at)
    SELECT p.id, 'th', ci.content, NOW()
    FROM posts p
    JOIN captions ci ON ci.post_id = p.id AND ci.network = 'ig'
    LEFT JOIN captions cth ON cth.post_id = p.id AND cth.network = 'th'
    WHERE p.user_id = ${UID}
      AND p.status_th = 'queued'
      AND ci.content <> ''
      AND (cth.post_id IS NULL OR cth.content = '')
    ON CONFLICT (post_id, network) DO UPDATE
      SET content = EXCLUDED.content, updated_at = NOW()
      WHERE captions.content = ''
    RETURNING post_id
  `);
  console.log(`\n== APPLY == linhas afetadas: ${upd.rows.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
