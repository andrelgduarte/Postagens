import { eq, sql } from "drizzle-orm";
import { db } from "../lib/db/client";
import {
  accounts as accountsTable,
  appConfig,
  posts as postsTable,
} from "../lib/db/schema";

async function main() {
  const [, , from, to] = process.argv;
  if (!from || !to) {
    console.error("uso: tsx scripts/reassign-user.ts <userId-origem> <userId-destino>");
    console.error("exemplo: tsx scripts/reassign-user.ts default-user user_2abc123xyz");
    process.exit(1);
  }

  const posted = await db
    .update(postsTable)
    .set({ userId: to })
    .where(eq(postsTable.userId, from))
    .returning({ id: postsTable.id });

  const acc = await db
    .update(accountsTable)
    .set({ userId: to })
    .where(eq(accountsTable.userId, from))
    .returning({ id: accountsTable.id });

  const cfg = await db
    .update(appConfig)
    .set({ userId: to })
    .where(eq(appConfig.userId, from))
    .returning({ key: appConfig.key });

  console.log(
    `Reatribuído ${from} → ${to}: ${posted.length} post(s), ${acc.length} conta(s), ${cfg.length} config(s).`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
