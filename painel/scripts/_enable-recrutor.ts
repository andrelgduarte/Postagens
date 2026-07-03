import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";
async function main() {
  const before = await db.execute(sql`
    SELECT value->'scheduler'->>'enabled' as enabled
    FROM app_config WHERE user_id = 'user_3FwldgMStLvJItpaUzHcPN98Wa5' AND key = 'main'
  `);
  console.log("scheduler.enabled ANTES:", before.rows[0]);

  await db.execute(sql`
    UPDATE app_config
    SET value = jsonb_set(value, '{scheduler,enabled}', 'true'::jsonb)
    WHERE user_id = 'user_3FwldgMStLvJItpaUzHcPN98Wa5' AND key = 'main'
  `);

  const after = await db.execute(sql`
    SELECT value->'scheduler' as scheduler
    FROM app_config WHERE user_id = 'user_3FwldgMStLvJItpaUzHcPN98Wa5' AND key = 'main'
  `);
  console.log("scheduler DEPOIS:", after.rows[0]);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
