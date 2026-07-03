import { db } from "../lib/db/client";
import { linkedinAccounts } from "../lib/db/schema";

async function main() {
  const rows = await db.select().from(linkedinAccounts);
  for (const r of rows) {
    console.log({
      user: r.userId,
      name: r.name,
      urn: r.personUrn,
      expires: r.tokenExpiresAt?.toISOString(),
      refresh_expires: r.refreshTokenExpiresAt?.toISOString(),
      updated: r.updatedAt.toISOString(),
      scope: r.scope,
    });
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
