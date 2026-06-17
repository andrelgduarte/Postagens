import { sql } from "drizzle-orm";
import { db } from "./db/client";

export async function listUsersWithActivity(): Promise<string[]> {
  const rows = await db.execute<{ user_id: string }>(sql`
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM posts
      UNION
      SELECT user_id FROM accounts
      UNION
      SELECT user_id FROM app_config
    ) u
    WHERE user_id IS NOT NULL AND user_id <> ''
  `);
  return rows.rows.map((r) => r.user_id);
}
