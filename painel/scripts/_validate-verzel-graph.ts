import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";

const GRAPH = "https://graph.facebook.com/v22.0";

async function main() {
  const rows = await db.execute(sql`
    SELECT token, ig_user_id, name
    FROM accounts
    WHERE external_id = 'e0cb9127'
  `);
  const acc = rows.rows[0] as { token: string; ig_user_id: string; name: string };
  if (!acc) throw new Error("conta Verzel News não achada");
  const { token, ig_user_id: igId } = acc;

  console.log(`=== validando conta ${acc.name} (${igId}) ===\n`);

  // 1. debug_token — validade e escopos (sem app_id/app_secret retorna limitado, mas ainda dá pra tentar)
  console.log("1) /debug_token");
  const dbg = await fetch(`${GRAPH}/debug_token?input_token=${token}&access_token=${token}`);
  const dbgJson = await dbg.json();
  console.log(JSON.stringify(dbgJson, null, 2));

  // 2. IG user info — username, tipo de conta
  console.log("\n2) /{ig_user_id}?fields=username,name,account_type,followers_count,media_count");
  const info = await fetch(`${GRAPH}/${igId}?fields=username,name,account_type,followers_count,media_count&access_token=${token}`);
  const infoJson = await info.json();
  console.log(JSON.stringify(infoJson, null, 2));

  // 3. Últimas mídias (garante que o token lê o feed da conta)
  console.log("\n3) /{ig_user_id}/media?limit=3");
  const media = await fetch(`${GRAPH}/${igId}/media?fields=id,caption,timestamp,media_type&limit=3&access_token=${token}`);
  const mediaJson = await media.json();
  console.log(JSON.stringify(mediaJson, null, 2));

  // 4. Verifica se a Página FB vinculada aparece com content_publishing_limit
  console.log("\n4) /{ig_user_id}/content_publishing_limit");
  const limit = await fetch(`${GRAPH}/${igId}/content_publishing_limit?access_token=${token}`);
  const limitJson = await limit.json();
  console.log(JSON.stringify(limitJson, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
