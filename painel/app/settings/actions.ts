"use server";

import { revalidatePath } from "next/cache";
import {
  type Account,
  type Config,
  type PostType,
  loadConfig,
  newAccountId,
  saveConfig,
} from "@/lib/config";

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

export async function saveLinkedIn(linkedin: Partial<Config["linkedin"]>): Promise<void> {
  const config = await loadConfig();
  config.linkedin = { ...config.linkedin, ...linkedin };
  await saveConfig(config);
  revalidatePath("/settings");
}

export async function testLinkedInWebhook(): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
}> {
  const config = await loadConfig();
  const url = config.linkedin?.webhook_url?.trim();
  if (!url) return { ok: false, error: "Webhook URL não configurada" };

  const { publishLinkedInWebhook } = await import("@/lib/linkedin-webhook");
  const result = await publishLinkedInWebhook({
    webhookUrl: url,
    payload: {
      slug: "teste-payload-painel",
      title: "Teste de payload — Painel",
      caption:
        "Esse é um payload de teste enviado pelo Painel de Postagens.\n\n" +
        "Se você está vendo isso no Make, o webhook funcionou e a estrutura JSON foi entregue corretamente.\n\n" +
        "Pode usar este payload pra mapear as variáveis no módulo do LinkedIn.\n\n" +
        "#teste #painel #datimidezalideranca",
      scheduled: "2026-06-18T10:00",
      type: "carousel",
      media: [
        {
          kind: "image",
          filename: "01.jpg",
          url: "https://placehold.co/1080x1080/0a0a0a/ffffff.png?text=Slide+1",
        },
        {
          kind: "image",
          filename: "02.jpg",
          url: "https://placehold.co/1080x1080/0a0a0a/ffffff.png?text=Slide+2",
        },
        {
          kind: "image",
          filename: "03.jpg",
          url: "https://placehold.co/1080x1080/0a0a0a/ffffff.png?text=Slide+3",
        },
      ],
    },
  });
  if (result.ok) return { ok: true, status: result.status };
  return { ok: false, status: result.status, error: result.error };
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
