import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const CONFIG_PATH = path.resolve(process.cwd(), "config.json");

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

export const DEFAULT_CONFIG: Config = {
  accounts: [],
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

function merge(partial: Partial<Config>): Config {
  return {
    accounts: partial.accounts ?? [],
    defaults: { ...DEFAULT_CONFIG.defaults, ...partial.defaults },
    scheduler: { ...DEFAULT_CONFIG.scheduler, ...partial.scheduler },
    staging_dir: partial.staging_dir ?? DEFAULT_CONFIG.staging_dir,
    notifications: { ...DEFAULT_CONFIG.notifications, ...partial.notifications },
  };
}

export async function loadConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return merge(JSON.parse(raw) as Partial<Config>);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
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

export async function listAccounts(): Promise<Account[]> {
  const config = await loadConfig();
  if (config.accounts.length > 0) return config.accounts;
  const legacy = legacyAccountFromEnv();
  return legacy ? [legacy] : [];
}

export async function getAccount(id?: string): Promise<Account> {
  const accounts = await listAccounts();
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
  const def = accounts.find((a) => a.is_default) ?? accounts[0];
  return def;
}

export function isLegacyAccount(account: Account): boolean {
  return account.id === LEGACY_ACCOUNT_ID;
}
