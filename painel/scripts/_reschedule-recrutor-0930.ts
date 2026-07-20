import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";

const UID = "user_3FwldgMStLvJItpaUzHcPN98Wa5";

async function main() {
  const apply = process.argv.includes("--apply");

  const preview = await db.execute(sql`
    SELECT slug,
           scheduled::text AS scheduled_atual,
           (date_trunc('day', scheduled) + interval '9 hours 30 minutes')::text AS scheduled_novo,
           status_ig, status_li, status_tt, status_th
    FROM posts
    WHERE user_id = ${UID}
      AND scheduled::date >= CURRENT_DATE
      AND (status_ig = 'queued' OR status_li = 'queued'
           OR status_tt = 'queued' OR status_th = 'queued')
    ORDER BY scheduled
  `);

  console.log(`\n=== Posts do Recrutor que teriam horário mudado pra 09:30 (${preview.rows.length}) ===`);
  for (const r of preview.rows) console.log(r);

  if (!apply) {
    console.log("\n(dry-run) rode com --apply para gravar.");
    return;
  }

  const upd = await db.execute(sql`
    UPDATE posts
    SET scheduled = date_trunc('day', scheduled) + interval '9 hours 30 minutes',
        updated_at = NOW()
    WHERE user_id = ${UID}
      AND scheduled::date >= CURRENT_DATE
      AND (status_ig = 'queued' OR status_li = 'queued'
           OR status_tt = 'queued' OR status_th = 'queued')
    RETURNING id
  `);
  console.log(`\n== APPLY == linhas afetadas: ${upd.rows.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
