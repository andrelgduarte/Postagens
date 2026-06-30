import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { threadsAccounts, type ThreadsAccount } from "./db/schema";

export async function getThreadsAccount(userId: string): Promise<ThreadsAccount | null> {
  const rows = await db
    .select()
    .from(threadsAccounts)
    .where(eq(threadsAccounts.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertThreadsAccount(opts: {
  userId: string;
  threadsUserId: string;
  username: string;
  avatarUrl: string | null;
  accessToken: string;
  tokenExpiresAt: Date | null;
  scope: string | null;
}): Promise<void> {
  const existing = await db
    .select({ id: threadsAccounts.id })
    .from(threadsAccounts)
    .where(and(eq(threadsAccounts.userId, opts.userId), eq(threadsAccounts.threadsUserId, opts.threadsUserId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(threadsAccounts)
      .set({
        username: opts.username,
        avatarUrl: opts.avatarUrl,
        accessToken: opts.accessToken,
        tokenExpiresAt: opts.tokenExpiresAt,
        scope: opts.scope,
        updatedAt: new Date(),
      })
      .where(eq(threadsAccounts.id, existing[0].id));
    return;
  }

  await db.insert(threadsAccounts).values({
    userId: opts.userId,
    threadsUserId: opts.threadsUserId,
    username: opts.username,
    avatarUrl: opts.avatarUrl,
    accessToken: opts.accessToken,
    tokenExpiresAt: opts.tokenExpiresAt,
    scope: opts.scope,
  });
}

export async function deleteThreadsAccount(userId: string, id: string): Promise<void> {
  await db
    .delete(threadsAccounts)
    .where(and(eq(threadsAccounts.userId, userId), eq(threadsAccounts.id, id)));
}
