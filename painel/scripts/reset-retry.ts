import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("uso: tsx scripts/reset-retry.ts <slug>");
    process.exit(1);
  }
  const result = await db.execute(
    sql`UPDATE posts SET attempts = 0, last_attempt = NULL, last_error = NULL WHERE slug = ${slug} RETURNING slug`
  );
  console.log(`Reset: ${result.rows.length} post(s)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
