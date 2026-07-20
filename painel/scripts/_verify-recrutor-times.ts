import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";
async function main() {
  const r = await db.execute(sql`
    SELECT to_char(scheduled, 'HH24:MI') AS hora, COUNT(*) AS qtd
    FROM posts
    WHERE user_id = 'user_3FwldgMStLvJItpaUzHcPN98Wa5'
      AND scheduled::date >= CURRENT_DATE
    GROUP BY 1 ORDER BY 1
  `);
  console.log(r.rows);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
