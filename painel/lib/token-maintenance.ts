import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "./db/client";
import { accounts as accountsTable } from "./db/schema";
import { extendToken } from "./meta-token";
import { logEvent } from "./publish-log";

const RENEW_BEFORE_DAYS = 7;

export type RenewalResult = {
  accountId: string;
  name: string;
  ok: boolean;
  newExpiresAt?: string;
  error?: string;
};

export async function maintainTokens(now: Date = new Date()): Promise<RenewalResult[]> {
  const threshold = new Date(now.getTime() + RENEW_BEFORE_DAYS * 86_400_000);
  const rows = await db
    .select()
    .from(accountsTable)
    .where(
      and(
        isNotNull(accountsTable.appId),
        isNotNull(accountsTable.appSecret),
        isNotNull(accountsTable.tokenExpiresAt),
        lt(accountsTable.tokenExpiresAt, threshold)
      )
    );

  const out: RenewalResult[] = [];
  for (const row of rows) {
    if (!row.appId || !row.appSecret) continue;
    try {
      const result = await extendToken({
        appId: row.appId,
        appSecret: row.appSecret,
        currentToken: row.token,
        version: row.graphVersion ?? undefined,
      });
      if (!result.ok || !result.token) {
        await logEvent({
          event: "publish_fail",
          account: row.name,
          message: `token renewal failed: ${result.error ?? "unknown"}`,
        });
        out.push({
          accountId: row.id,
          name: row.name,
          ok: false,
          error: result.error,
        });
        continue;
      }
      await db
        .update(accountsTable)
        .set({
          token: result.token,
          tokenExpiresAt: result.expiresAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(accountsTable.id, row.id));
      await logEvent({
        event: "publish_ok",
        account: row.name,
        message: `token renewed (expires ${result.expiresAt?.toISOString() ?? "unknown"})`,
      });
      out.push({
        accountId: row.id,
        name: row.name,
        ok: true,
        newExpiresAt: result.expiresAt?.toISOString(),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await logEvent({ event: "publish_fail", account: row.name, message: `token renewal: ${message}` });
      out.push({ accountId: row.id, name: row.name, ok: false, error: message });
    }
  }
  return out;
}
