import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";

const ANDRE = "user_3FGh29qmsB3VcOGjO62SBGZZm15";
const SLUG_1807 = "2026-07-18-o-silencio-do-lider-tecnico-custa-caro";

async function main() {
  const apply = process.argv.includes("--apply");

  console.log("=== 1) Posts do Andre onde LI caption está vazia/ausente e IG tem texto ===");
  const targets = await db.execute(sql`
    SELECT p.slug, p.status_li,
           COALESCE(li.content, '') AS li_atual,
           LEFT(ig.content, 80) AS ig_preview,
           LENGTH(ig.content) AS ig_len
    FROM posts p
    JOIN captions ig ON ig.post_id = p.id AND ig.network = 'ig'
    LEFT JOIN captions li ON li.post_id = p.id AND li.network = 'li'
    WHERE p.user_id = ${ANDRE}
      AND LENGTH(TRIM(ig.content)) > 0
      AND (li.content IS NULL OR LENGTH(TRIM(li.content)) = 0)
    ORDER BY p.scheduled
  `);
  for (const r of targets.rows) console.log(r);
  console.log(`Total: ${targets.rows.length}`);

  console.log("\n=== 2) Post 2026-07-18 auto_publish atual ===");
  const p18 = await db.execute(sql`
    SELECT slug, auto_publish, status_ig, status_li, status_tt, status_th
    FROM posts WHERE user_id = ${ANDRE} AND slug = ${SLUG_1807}
  `);
  for (const r of p18.rows) console.log(r);

  if (!apply) {
    console.log("\n(dry-run: rode com --apply para aplicar)");
    return;
  }

  console.log("\n== APPLY 1: INSERT/UPDATE captions LI copiando de IG ==");
  const up1 = await db.execute(sql`
    INSERT INTO captions (post_id, network, content, updated_at)
    SELECT p.id, 'li', ig.content, NOW()
    FROM posts p
    JOIN captions ig ON ig.post_id = p.id AND ig.network = 'ig'
    LEFT JOIN captions li ON li.post_id = p.id AND li.network = 'li'
    WHERE p.user_id = ${ANDRE}
      AND LENGTH(TRIM(ig.content)) > 0
      AND (li.content IS NULL OR LENGTH(TRIM(li.content)) = 0)
    ON CONFLICT (post_id, network) DO UPDATE
      SET content = EXCLUDED.content, updated_at = NOW()
    RETURNING post_id
  `);
  console.log(`captions afetadas: ${up1.rows.length}`);

  console.log("\n== APPLY 2: auto_publish=true no post 2026-07-18 ==");
  const up2 = await db.execute(sql`
    UPDATE posts SET auto_publish = true, updated_at = NOW()
    WHERE user_id = ${ANDRE} AND slug = ${SLUG_1807}
    RETURNING id, slug, auto_publish
  `);
  for (const r of up2.rows) console.log(r);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
