import { eq, and } from "drizzle-orm";
import { db } from "./db/client";
import { linkedinAccounts, type LinkedinAccount } from "./db/schema";

export async function getLinkedinAccount(userId: string): Promise<LinkedinAccount | null> {
  const rows = await db
    .select()
    .from(linkedinAccounts)
    .where(eq(linkedinAccounts.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertLinkedinAccount(opts: {
  userId: string;
  personUrn: string;
  name: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
}): Promise<void> {
  const existing = await db
    .select({ id: linkedinAccounts.id })
    .from(linkedinAccounts)
    .where(and(eq(linkedinAccounts.userId, opts.userId), eq(linkedinAccounts.personUrn, opts.personUrn)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(linkedinAccounts)
      .set({
        name: opts.name,
        accessToken: opts.accessToken,
        refreshToken: opts.refreshToken,
        tokenExpiresAt: opts.tokenExpiresAt,
        refreshTokenExpiresAt: opts.refreshTokenExpiresAt,
        scope: opts.scope,
        updatedAt: new Date(),
      })
      .where(eq(linkedinAccounts.id, existing[0].id));
    return;
  }

  await db.insert(linkedinAccounts).values({
    userId: opts.userId,
    personUrn: opts.personUrn,
    name: opts.name,
    accessToken: opts.accessToken,
    refreshToken: opts.refreshToken,
    tokenExpiresAt: opts.tokenExpiresAt,
    refreshTokenExpiresAt: opts.refreshTokenExpiresAt,
    scope: opts.scope,
  });
}

export async function deleteLinkedinAccount(userId: string, id: string): Promise<void> {
  await db
    .delete(linkedinAccounts)
    .where(and(eq(linkedinAccounts.userId, userId), eq(linkedinAccounts.id, id)));
}
