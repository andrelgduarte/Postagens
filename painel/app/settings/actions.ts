"use server";

import { revalidatePath } from "next/cache";
import {
  type Account,
  type Config,
  loadConfig,
  newAccountId,
  saveConfig,
} from "@/lib/config";
import { currentUserId } from "@/lib/auth";
import { deleteLinkedinAccount as dbDeleteLinkedinAccount, getLinkedinAccount } from "@/lib/linkedin-accounts";
import { deleteTiktokAccount as dbDeleteTiktokAccount, getTiktokAccount } from "@/lib/tiktok-accounts";
import { deleteThreadsAccount as dbDeleteThreadsAccount, getThreadsAccount } from "@/lib/threads-accounts";

export type LinkedinAccountInfo = {
  id: string;
  name: string;
  personUrn: string;
  tokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scope: string | null;
} | null;

export async function getLinkedinAccountInfo(): Promise<LinkedinAccountInfo> {
  const uid = await currentUserId();
  const row = await getLinkedinAccount(uid);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    personUrn: row.personUrn,
    tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
    refreshTokenExpiresAt: row.refreshTokenExpiresAt?.toISOString() ?? null,
    scope: row.scope,
  };
}

export async function disconnectLinkedinAccount(id: string): Promise<void> {
  const uid = await currentUserId();
  await dbDeleteLinkedinAccount(uid, id);
  revalidatePath("/settings");
}

export type TiktokAccountInfo = {
  id: string;
  displayName: string;
  openId: string;
  avatarUrl: string | null;
  tokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scope: string | null;
} | null;

export async function getTiktokAccountInfo(): Promise<TiktokAccountInfo> {
  const uid = await currentUserId();
  const row = await getTiktokAccount(uid);
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.displayName,
    openId: row.openId,
    avatarUrl: row.avatarUrl,
    tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
    refreshTokenExpiresAt: row.refreshTokenExpiresAt?.toISOString() ?? null,
    scope: row.scope,
  };
}

export async function disconnectTiktokAccount(id: string): Promise<void> {
  const uid = await currentUserId();
  await dbDeleteTiktokAccount(uid, id);
  revalidatePath("/settings");
}

export type ThreadsAccountInfo = {
  id: string;
  username: string;
  threadsUserId: string;
  avatarUrl: string | null;
  tokenExpiresAt: string | null;
  scope: string | null;
} | null;

export async function getThreadsAccountInfo(): Promise<ThreadsAccountInfo> {
  const uid = await currentUserId();
  const row = await getThreadsAccount(uid);
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    threadsUserId: row.threadsUserId,
    avatarUrl: row.avatarUrl,
    tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
    scope: row.scope,
  };
}

export async function disconnectThreadsAccount(id: string): Promise<void> {
  const uid = await currentUserId();
  await dbDeleteThreadsAccount(uid, id);
  revalidatePath("/settings");
}

function sanitizeAccount(input: Partial<Account>): Account {
  const name = String(input.name ?? "").trim();
  const ig_user_id = String(input.ig_user_id ?? "").trim();
  const token = String(input.token ?? "").trim();
  if (!name) throw new Error("Nome da conta é obrigatório");
  if (!ig_user_id) throw new Error("IG user ID é obrigatório");
  if (!token) throw new Error("Token é obrigatório");
  return {
    id: input.id && input.id !== "_env" ? input.id : newAccountId(),
    name,
    ig_user_id,
    token,
    graph_version: input.graph_version?.trim() || undefined,
    is_default: Boolean(input.is_default),
  };
}

export async function upsertAccount(input: Partial<Account>): Promise<void> {
  const config = await loadConfig();
  const account = sanitizeAccount(input);
  const existingIdx = config.accounts.findIndex((a) => a.id === account.id);
  if (existingIdx >= 0) config.accounts[existingIdx] = account;
  else config.accounts.push(account);

  if (account.is_default) {
    config.accounts = config.accounts.map((a) =>
      a.id === account.id ? a : { ...a, is_default: false }
    );
  } else if (!config.accounts.some((a) => a.is_default)) {
    config.accounts[0].is_default = true;
  }

  await saveConfig(config);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function deleteAccount(id: string): Promise<void> {
  const config = await loadConfig();
  config.accounts = config.accounts.filter((a) => a.id !== id);
  if (config.accounts.length > 0 && !config.accounts.some((a) => a.is_default)) {
    config.accounts[0].is_default = true;
  }
  await saveConfig(config);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function setDefaultAccount(id: string): Promise<void> {
  const config = await loadConfig();
  config.accounts = config.accounts.map((a) => ({ ...a, is_default: a.id === id }));
  await saveConfig(config);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function saveDefaults(
  defaults: Partial<Config["defaults"]>
): Promise<void> {
  const config = await loadConfig();
  config.defaults = { ...config.defaults, ...defaults };
  await saveConfig(config);
  revalidatePath("/settings");
}

export async function saveScheduler(
  scheduler: Partial<Config["scheduler"]>
): Promise<void> {
  const config = await loadConfig();
  config.scheduler = {
    ...config.scheduler,
    ...scheduler,
    interval_minutes: clamp(scheduler.interval_minutes, 5, 1440, config.scheduler.interval_minutes),
    retries: clamp(scheduler.retries, 0, 10, config.scheduler.retries),
    retry_delay_minutes: clamp(
      scheduler.retry_delay_minutes,
      1,
      60,
      config.scheduler.retry_delay_minutes
    ),
  };
  await saveConfig(config);
  revalidatePath("/settings");
}

export async function saveStaging(staging_dir: string): Promise<void> {
  const config = await loadConfig();
  config.staging_dir = staging_dir.trim() || "staging";
  await saveConfig(config);
  revalidatePath("/settings");
}

export async function saveNotifications(
  notifications: Partial<Config["notifications"]>
): Promise<void> {
  const config = await loadConfig();
  config.notifications = { ...config.notifications, ...notifications };
  await saveConfig(config);
  revalidatePath("/settings");
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
