import crypto from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "./db/client";
import { accounts as accountsTable, appConfig } from "./db/schema";
import { currentUserId, DEFAULT_USER_ID } from "./auth";

export type Account = {
  id: string;
  name: string;
  ig_user_id: string;
  token: string;
  graph_version?: string;
  is_default: boolean;
};

export type PostType = "single" | "carousel" | "reel" | "story";

export type PublishMode = "off" | "semi" | "auto";

export type Config = {
  accounts: Account[];
  defaults: {
    type: PostType;
    networks: ("ig" | "li")[];
    auto_publish: boolean;
    time: string;
  };
  scheduler: {
    enabled: boolean;
    interval_minutes: number;
    window_start: string;
    window_end: string;
    retries: number;
    retry_delay_minutes: number;
  };
  staging_dir: string;
  notifications: {
    advance_minutes: number;
    toast_on_publish: boolean;
  };
};

const CONFIG_KEY = "main";

type StoredConfig = Omit<Config, "accounts">;

const DEFAULT_STORED: StoredConfig = {
  defaults: {
    type: "single",
    networks: ["ig", "li"],
    auto_publish: false,
    time: "08:30",
  },
  scheduler: {
    enabled: false,
    interval_minutes: 30,
    window_start: "06:00",
    window_end: "23:00",
    retries: 3,
    retry_delay_minutes: 5,
  },
  staging_dir: "staging",
  notifications: {
    advance_minutes: 0,
    toast_on_publish: true,
  },
};

export const DEFAULT_CONFIG: Config = { accounts: [], ...DEFAULT_STORED };

function mergeStored(partial: Partial<StoredConfig>): StoredConfig {
  return {
    defaults: { ...DEFAULT_STORED.defaults, ...partial.defaults },
    scheduler: { ...DEFAULT_STORED.scheduler, ...partial.scheduler },
    staging_dir: partial.staging_dir ?? DEFAULT_STORED.staging_dir,
    notifications: { ...DEFAULT_STORED.notifications, ...partial.notifications },
  };
}

function rowToAccount(row: typeof accountsTable.$inferSelect): Account {
  return {
    id: row.externalId,
    name: row.name,
    ig_user_id: row.igUserId,
    token: row.token,
    graph_version: row.graphVersion ?? undefined,
    is_default: row.isDefault,
  };
}

async function resolveUserId(userId?: string): Promise<string> {
  return userId ?? (await currentUserId());
}

async function loadStored(userId: string): Promise<StoredConfig> {
  const rows = await db
    .select()
    .from(appConfig)
    .where(and(eq(appConfig.userId, userId), eq(appConfig.key, CONFIG_KEY)));
  const row = rows[0];
  if (!row) return DEFAULT_STORED;
  return mergeStored((row.value as Partial<StoredConfig>) ?? {});
}

export async function loadConfig(userId?: string): Promise<Config> {
  const uid = await resolveUserId(userId);
  const [stored, accounts] = await Promise.all([loadStored(uid), listAccounts(uid)]);
  return { accounts, ...stored };
}

export async function saveConfig(config: Config, userId?: string): Promise<void> {
  const uid = await resolveUserId(userId);
  await Promise.all([replaceAccounts(config.accounts, uid), saveStored(config, uid)]);
}

async function saveStored(config: Config, userId: string): Promise<void> {
  const stored: StoredConfig = {
    defaults: config.defaults,
    scheduler: config.scheduler,
    staging_dir: config.staging_dir,
    notifications: config.notifications,
  };
  await db
    .insert(appConfig)
    .values({ userId, key: CONFIG_KEY, value: stored, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [appConfig.userId, appConfig.key],
      set: { value: stored, updatedAt: new Date() },
    });
}

async function replaceAccounts(input: Account[], userId: string): Promise<void> {
  const wanted = new Set(input.map((a) => a.id));
  const existing = await db.select().from(accountsTable).where(eq(accountsTable.userId, userId));
  const toDelete = existing.filter((r) => !wanted.has(r.externalId));
  if (toDelete.length > 0) {
    await db
      .delete(accountsTable)
      .where(
        and(
          eq(accountsTable.userId, userId),
          sql`${accountsTable.externalId} IN ${toDelete.map((r) => r.externalId)}`
        )
      );
  }
  for (const a of input) {
    await upsertAccountRow(a, userId);
  }
}

async function upsertAccountRow(a: Account, userId: string): Promise<void> {
  const values = {
    userId,
    externalId: a.id,
    name: a.name,
    igUserId: a.ig_user_id,
    token: a.token,
    graphVersion: a.graph_version ?? null,
    isDefault: a.is_default,
    updatedAt: new Date(),
  };
  await db
    .insert(accountsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [accountsTable.userId, accountsTable.externalId],
      set: values,
    });
  if (a.is_default) {
    await db
      .update(accountsTable)
      .set({ isDefault: false })
      .where(
        and(
          eq(accountsTable.userId, userId),
          eq(accountsTable.isDefault, true),
          ne(accountsTable.externalId, a.id)
        )
      );
  }
}

export function newAccountId(): string {
  return crypto.randomBytes(4).toString("hex");
}

const LEGACY_ACCOUNT_ID = "_env";

export function legacyAccountFromEnv(): Account | null {
  const token = process.env.META_ACCESS_TOKEN;
  const igUserId = process.env.META_IG_USER_ID;
  if (!token || !igUserId) return null;
  return {
    id: LEGACY_ACCOUNT_ID,
    name: "Conta padrão (.env.local)",
    ig_user_id: igUserId,
    token,
    graph_version: process.env.META_GRAPH_VERSION,
    is_default: true,
  };
}

export async function listAccounts(userId?: string): Promise<Account[]> {
  const uid = await resolveUserId(userId);
  const rows = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.userId, uid))
    .orderBy(accountsTable.createdAt);
  if (rows.length > 0) return rows.map(rowToAccount);
  if (uid === DEFAULT_USER_ID) {
    const legacy = legacyAccountFromEnv();
    return legacy ? [legacy] : [];
  }
  return [];
}

export async function getAccount(id?: string, userId?: string): Promise<Account> {
  const accounts = await listAccounts(userId);
  if (accounts.length === 0) {
    throw new Error(
      "Nenhuma conta configurada. Vá em /settings e adicione uma conta do Instagram."
    );
  }
  if (id) {
    const found = accounts.find((a) => a.id === id);
    if (!found) throw new Error(`Conta '${id}' não encontrada em /settings`);
    return found;
  }
  return accounts.find((a) => a.is_default) ?? accounts[0];
}

export async function getAccountUuid(externalId: string, userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: accountsTable.id })
    .from(accountsTable)
    .where(and(eq(accountsTable.userId, userId), eq(accountsTable.externalId, externalId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function getAccountExternalId(uuid: string): Promise<string | null> {
  const rows = await db
    .select({ externalId: accountsTable.externalId })
    .from(accountsTable)
    .where(eq(accountsTable.id, uuid))
    .limit(1);
  return rows[0]?.externalId ?? null;
}

export function isLegacyAccount(account: Account): boolean {
  return account.id === LEGACY_ACCOUNT_ID;
}
