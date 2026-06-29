import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { tiktokAccounts, type TiktokAccount } from "./db/schema";

export async function getTiktokAccount(userId: string): Promise<TiktokAccount | null> {
  const rows = await db
    .select()
    .from(tiktokAccounts)
    .where(eq(tiktokAccounts.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertTiktokAccount(opts: {
  userId: string;
  openId: string;
  unionId: string | null;
  displayName: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
}): Promise<void> {
  const existing = await db
    .select({ id: tiktokAccounts.id })
    .from(tiktokAccounts)
    .where(and(eq(tiktokAccounts.userId, opts.userId), eq(tiktokAccounts.openId, opts.openId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(tiktokAccounts)
      .set({
        unionId: opts.unionId,
        displayName: opts.displayName,
        avatarUrl: opts.avatarUrl,
        accessToken: opts.accessToken,
        refreshToken: opts.refreshToken,
        tokenExpiresAt: opts.tokenExpiresAt,
        refreshTokenExpiresAt: opts.refreshTokenExpiresAt,
        scope: opts.scope,
        updatedAt: new Date(),
      })
      .where(eq(tiktokAccounts.id, existing[0].id));
    return;
  }

  await db.insert(tiktokAccounts).values({
    userId: opts.userId,
    openId: opts.openId,
    unionId: opts.unionId,
    displayName: opts.displayName,
    avatarUrl: opts.avatarUrl,
    accessToken: opts.accessToken,
    refreshToken: opts.refreshToken,
    tokenExpiresAt: opts.tokenExpiresAt,
    refreshTokenExpiresAt: opts.refreshTokenExpiresAt,
    scope: opts.scope,
  });
}

export async function deleteTiktokAccount(userId: string, id: string): Promise<void> {
  await db
    .delete(tiktokAccounts)
    .where(and(eq(tiktokAccounts.userId, userId), eq(tiktokAccounts.id, id)));
}
