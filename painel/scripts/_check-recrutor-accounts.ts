import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";
const UID = "user_3FwldgMStLvJItpaUzHcPN98Wa5";
async function main() {
  console.log("=== IG accounts do recrutor ===");
  console.log((await db.execute(sql`SELECT name, is_default, ig_user_id FROM accounts WHERE user_id = ${UID}`)).rows);
  console.log("=== LI accounts do recrutor ===");
  console.log((await db.execute(sql`SELECT name, person_urn FROM linkedin_accounts WHERE user_id = ${UID}`)).rows);
  console.log("=== TH accounts do recrutor ===");
  console.log((await db.execute(sql`SELECT username, threads_user_id FROM threads_accounts WHERE user_id = ${UID}`)).rows);
  console.log("=== TT accounts do recrutor ===");
  console.log((await db.execute(sql`SELECT display_name, open_id FROM tiktok_accounts WHERE user_id = ${UID}`)).rows);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
