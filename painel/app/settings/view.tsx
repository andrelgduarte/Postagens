"use client";

import { useState, useTransition } from "react";
import type { Account, Config, PostType } from "@/lib/config";
import type { Network } from "@/lib/networks";
import {
  type LinkedinAccountInfo,
  type ThreadsAccountInfo,
  type TiktokAccountInfo,
  deleteAccount,
  disconnectLinkedinAccount,
  disconnectThreadsAccount,
  disconnectTiktokAccount,
  saveDefaults,
  saveNotifications,
  saveScheduler,
  saveStaging,
  setDefaultAccount,
  upsertAccount,
} from "./actions";

const TYPE_LABELS: Record<PostType, string> = {
  single: "Imagem única",
  carousel: "Carrossel",
  reel: "Reel (vídeo)",
  story: "Story",
};

export function SettingsView({
  config,
  legacyHint,
  disabledNetworks,
  linkedinAccount,
  linkedinStatus,
  tiktokAccount,
  tiktokStatus,
  threadsAccount,
  threadsStatus,
}: {
  config: Config;
  legacyHint: Account | null;
  disabledNetworks: Network[];
  linkedinAccount: LinkedinAccountInfo;
  linkedinStatus?: { ok?: boolean; error?: string };
  tiktokAccount: TiktokAccountInfo;
  tiktokStatus?: { ok?: boolean; error?: string };
  threadsAccount: ThreadsAccountInfo;
  threadsStatus?: { ok?: boolean; error?: string };
}) {
  const disabled = new Set(disabledNetworks);
  return (
    <div className="space-y-10">
      <AccountsSection accounts={config.accounts} legacyHint={legacyHint} />
      <DefaultsSection defaults={config.defaults} disabled={disabled} />
      <SchedulerSection scheduler={config.scheduler} />
      <NotificationsSection notifications={config.notifications} />
      {!disabled.has("li") && <LinkedInSection account={linkedinAccount} status={linkedinStatus} />}
      {!disabled.has("tt") && <TikTokSection account={tiktokAccount} status={tiktokStatus} />}
      {!disabled.has("th") && <ThreadsSection account={threadsAccount} status={threadsStatus} />}
      <StagingSection staging_dir={config.staging_dir} />
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-xs text-neutral-500 mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function AccountsSection({
  accounts,
  legacyHint,
}: {
  accounts: Account[];
  legacyHint: Account | null;
}) {
  const [editing, setEditing] = useState<Account | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Section
      title="Contas do Instagram"
      description="Cada post pode escolher em qual conta publicar. Marque uma como padrão."
    >
      {accounts.length === 0 && legacyHint && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-sm space-y-2">
          <p className="font-medium">Detectamos credenciais no .env.local</p>
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Enquanto não houver conta salva aqui, o sistema usa o .env como fallback. Clique para
            migrar de forma permanente.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing({ ...legacyHint, id: "" })}
            className="rounded-md bg-amber-600 text-white text-xs px-3 py-1.5 hover:bg-amber-700"
          >
            Migrar conta do .env
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {accounts.map((acc) => (
          <li
            key={acc.id}
            className="flex items-center gap-3 rounded-md border border-neutral-200 dark:border-neutral-800 p-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{acc.name}</span>
                {acc.is_default && (
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium px-2 py-0.5">
                    padrão
                  </span>
                )}
              </div>
              <div className="text-xs font-mono text-neutral-500 truncate">
                IG ID: {acc.ig_user_id}
              </div>
              <TokenExpiryBadge expiresAt={acc.token_expires_at} hasAppCreds={Boolean(acc.app_id && acc.app_secret)} />
            </div>
            {!acc.is_default && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await setDefaultAccount(acc.id);
                  })
                }
                className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Tornar padrão
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(acc)}
              className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Remover "${acc.name}"?`)) return;
                startTransition(async () => {
                  await deleteAccount(acc.id);
                });
              }}
              className="text-xs rounded-md border border-red-300 text-red-700 dark:text-red-400 dark:border-red-800 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>

      {!editing && (
        <button
          type="button"
          onClick={() =>
            setEditing({
              id: "",
              name: "",
              ig_user_id: "",
              token: "",
              app_id: "",
              app_secret: "",
              graph_version: "",
              is_default: accounts.length === 0,
            })
          }
          className="rounded-md bg-neutral-900 text-white text-sm px-3 py-1.5 hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
        >
          + Nova conta
        </button>
      )}

      {editing && (
        <AccountForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </Section>
  );
}

function AccountForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Account;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Account>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await upsertAccount(form);
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="rounded-md border border-neutral-300 dark:border-neutral-700 p-4 space-y-3 bg-neutral-50 dark:bg-neutral-800/40">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Nome"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          placeholder="Ex: Pessoal"
        />
        <Field
          label="IG User ID"
          value={form.ig_user_id}
          onChange={(v) => setForm({ ...form, ig_user_id: v })}
          placeholder="17841..."
          mono
        />
      </div>
      <Field
        label="Page Access Token"
        value={form.token}
        onChange={(v) => setForm({ ...form, token: v })}
        placeholder="EAAB..."
        mono
        type="password"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="App ID (opcional)"
          value={form.app_id ?? ""}
          onChange={(v) => setForm({ ...form, app_id: v })}
          placeholder="123456789012345"
          mono
        />
        <Field
          label="App Secret (opcional)"
          value={form.app_secret ?? ""}
          onChange={(v) => setForm({ ...form, app_secret: v })}
          placeholder="••••••••"
          mono
          type="password"
        />
      </div>
      <p className="text-xs text-neutral-500 -mt-1">
        Preencha App ID e Secret para o sistema renovar o token automaticamente antes de vencer.
      </p>
      <Field
        label="Graph version (opcional)"
        value={form.graph_version ?? ""}
        onChange={(v) => setForm({ ...form, graph_version: v })}
        placeholder="v22.0"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
        />
        Usar como conta padrão
      </label>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="text-sm rounded-md bg-neutral-900 text-white px-3 py-1.5 hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Salvando…" : "Salvar conta"}
        </button>
      </div>
    </div>
  );
}

function TokenExpiryBadge({
  expiresAt,
  hasAppCreds,
}: {
  expiresAt?: string;
  hasAppCreds: boolean;
}) {
  const [now] = useState(() => Date.now());
  if (!expiresAt) {
    return hasAppCreds ? (
      <div className="mt-1 text-[11px] text-neutral-500">validade do token desconhecida</div>
    ) : (
      <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
        sem App ID/Secret — renovação manual
      </div>
    );
  }
  const days = Math.round((new Date(expiresAt).getTime() - now) / 86_400_000);
  const tone =
    days < 0
      ? "text-red-700 dark:text-red-400"
      : days <= 7
        ? "text-amber-700 dark:text-amber-400"
        : "text-neutral-500";
  const label =
    days < 0
      ? `token expirado há ${Math.abs(days)} dia(s)`
      : days === 0
        ? "token vence hoje"
        : `token vence em ${days} dia(s)`;
  return <div className={`mt-1 text-[11px] ${tone}`}>{label}</div>;
}

function DefaultsSection({
  defaults,
  disabled,
}: {
  defaults: Config["defaults"];
  disabled: Set<Network>;
}) {
  const [form, setForm] = useState(defaults);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await saveDefaults(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function toggleNetwork(net: "ig" | "li" | "tt" | "th") {
    const next = form.networks.includes(net)
      ? form.networks.filter((n) => n !== net)
      : [...form.networks, net];
    setForm({ ...form, networks: next });
  }

  return (
    <Section title="Padrões para novos posts">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Tipo</span>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as PostType })}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          >
            {(Object.keys(TYPE_LABELS) as PostType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Horário padrão</span>
          <input
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-neutral-500">Redes:</span>
        {!disabled.has("ig") && (
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={form.networks.includes("ig")}
              onChange={() => toggleNetwork("ig")}
            />
            Instagram
          </label>
        )}
        {!disabled.has("li") && (
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={form.networks.includes("li")}
              onChange={() => toggleNetwork("li")}
            />
            LinkedIn
          </label>
        )}
        {!disabled.has("tt") && (
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={form.networks.includes("tt")}
              onChange={() => toggleNetwork("tt")}
            />
            TikTok
          </label>
        )}
        {!disabled.has("th") && (
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={form.networks.includes("th")}
              onChange={() => toggleNetwork("th")}
            />
            Threads
          </label>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.auto_publish}
          onChange={(e) => setForm({ ...form, auto_publish: e.target.checked })}
        />
        Publicar automaticamente por padrão (scheduler vai postar sem confirmação)
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="text-sm rounded-md bg-neutral-900 text-white px-3 py-1.5 hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {saved ? "Salvo ✓" : pending ? "Salvando…" : "Salvar padrões"}
        </button>
      </div>
    </Section>
  );
}

function SchedulerSection({ scheduler }: { scheduler: Config["scheduler"] }) {
  const [form, setForm] = useState(scheduler);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await saveScheduler(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <Section
      title="Scheduler autônomo"
      description="Quando ligado, o worker publica posts vencidos com auto_publish=true. (Requer worker rodando — M4.)"
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
        />
        Ativar publicação automática
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Intervalo (min)</span>
          <input
            type="number"
            min={5}
            max={1440}
            value={form.interval_minutes}
            onChange={(e) =>
              setForm({ ...form, interval_minutes: Number(e.target.value) || 30 })
            }
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Janela início</span>
          <input
            type="time"
            value={form.window_start}
            onChange={(e) => setForm({ ...form, window_start: e.target.value })}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Janela fim</span>
          <input
            type="time"
            value={form.window_end}
            onChange={(e) => setForm({ ...form, window_end: e.target.value })}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Tentativas</span>
          <input
            type="number"
            min={0}
            max={10}
            value={form.retries}
            onChange={(e) => setForm({ ...form, retries: Number(e.target.value) || 0 })}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm max-w-xs">
        <span className="text-neutral-500">Atraso entre tentativas (min)</span>
        <input
          type="number"
          min={1}
          max={60}
          value={form.retry_delay_minutes}
          onChange={(e) =>
            setForm({ ...form, retry_delay_minutes: Number(e.target.value) || 5 })
          }
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="text-sm rounded-md bg-neutral-900 text-white px-3 py-1.5 hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {saved ? "Salvo ✓" : pending ? "Salvando…" : "Salvar scheduler"}
        </button>
      </div>
    </Section>
  );
}

function NotificationsSection({
  notifications,
}: {
  notifications: Config["notifications"];
}) {
  const [form, setForm] = useState(notifications);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await saveNotifications(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <Section title="Notificações">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Antecedência (min)</span>
          <input
            type="number"
            min={0}
            max={120}
            value={form.advance_minutes}
            onChange={(e) =>
              setForm({ ...form, advance_minutes: Number(e.target.value) || 0 })
            }
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.toast_on_publish}
          onChange={(e) => setForm({ ...form, toast_on_publish: e.target.checked })}
        />
        Mostrar toast do Windows após publicação automática
      </label>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="text-sm rounded-md bg-neutral-900 text-white px-3 py-1.5 hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {saved ? "Salvo ✓" : pending ? "Salvando…" : "Salvar notificações"}
        </button>
      </div>
    </Section>
  );
}

function LinkedInSection({
  account,
  status,
}: {
  account: LinkedinAccountInfo;
  status?: { ok?: boolean; error?: string };
}) {
  const [pending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());

  function disconnect() {
    if (!account) return;
    if (!confirm(`Desconectar ${account.name}? Posts com status_li=queued vão parar de sair até reconectar.`)) return;
    startTransition(async () => {
      await disconnectLinkedinAccount(account.id);
    });
  }

  const expires = account?.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
  const daysToExpire = expires ? Math.floor((expires.getTime() - now) / 86_400_000) : null;

  return (
    <Section
      title="LinkedIn (API direta)"
      description="Conexão OAuth direta com seu perfil pessoal do LinkedIn. Posts com status_li=queued e auto_publish=true são publicados via /rest/posts."
    >
      {status?.ok && (
        <div className="text-xs rounded-md px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
          ✓ Conta conectada com sucesso.
        </div>
      )}
      {status?.error && (
        <div className="text-xs rounded-md px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
          ✗ {status.error}
        </div>
      )}

      {!account ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Nenhuma conta conectada. Conectar abre a tela de autorização do LinkedIn — marque todos
            os checkboxes (precisa de <code className="font-mono">w_member_social</code> pra postar).
          </p>
          <a
            href="/api/auth/linkedin/start"
            className="self-start text-sm rounded-md bg-[#0a66c2] text-white px-4 py-2 hover:bg-[#004182]"
          >
            Conectar LinkedIn
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3 text-sm space-y-1">
            <div>
              <span className="text-neutral-500">Conta:</span>{" "}
              <span className="font-medium">{account.name}</span>
            </div>
            <div className="text-xs text-neutral-500">
              <code className="font-mono">{account.personUrn}</code>
            </div>
            {expires && (
              <div className="text-xs text-neutral-500">
                Token expira em {expires.toLocaleString("pt-BR")}
                {daysToExpire !== null && ` (~${daysToExpire} dias)`}
              </div>
            )}
            {account.scope && (
              <div className="text-xs text-neutral-500">
                Scopes: <code className="font-mono">{account.scope}</code>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <a
              href="/api/auth/linkedin/start"
              className="text-sm rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Reconectar
            </a>
            <button
              type="button"
              onClick={disconnect}
              disabled={pending}
              className="text-sm rounded-md border border-red-300 dark:border-red-900 text-red-700 dark:text-red-300 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
            >
              {pending ? "Desconectando…" : "Desconectar"}
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function TikTokSection({
  account,
  status,
}: {
  account: TiktokAccountInfo;
  status?: { ok?: boolean; error?: string };
}) {
  const [pending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());

  function disconnect() {
    if (!account) return;
    if (!confirm(`Desconectar ${account.displayName}? Posts com status_tt=queued vão parar de sair até reconectar.`)) return;
    startTransition(async () => {
      await disconnectTiktokAccount(account.id);
    });
  }

  const expires = account?.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
  const daysToExpire = expires ? Math.floor((expires.getTime() - now) / 86_400_000) : null;

  return (
    <Section
      title="TikTok (inbox/drafts)"
      description="Conexão OAuth com sua conta do TikTok. Posts com status_tt=queued e auto_publish=true vão pro inbox do app — você abre o TikTok pra finalizar."
    >
      {status?.ok && (
        <div className="text-xs rounded-md px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
          ✓ Conta conectada com sucesso.
        </div>
      )}
      {status?.error && (
        <div className="text-xs rounded-md px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
          ✗ {status.error}
        </div>
      )}

      {!account ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Nenhuma conta conectada. Conectar abre a tela de autorização do TikTok — exige scope{" "}
            <code className="font-mono">video.upload</code> (inbox/draft, sem auditoria).
          </p>
          <a
            href="/api/auth/tiktok/start"
            className="self-start text-sm rounded-md bg-black text-white px-4 py-2 hover:bg-neutral-800"
          >
            Conectar TikTok
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3 text-sm space-y-1">
            <div>
              <span className="text-neutral-500">Conta:</span>{" "}
              <span className="font-medium">{account.displayName}</span>
            </div>
            <div className="text-xs text-neutral-500">
              <code className="font-mono">{account.openId}</code>
            </div>
            {expires && (
              <div className="text-xs text-neutral-500">
                Token expira em {expires.toLocaleString("pt-BR")}
                {daysToExpire !== null && ` (~${daysToExpire} dias)`}
              </div>
            )}
            {account.scope && (
              <div className="text-xs text-neutral-500">
                Scopes: <code className="font-mono">{account.scope}</code>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <a
              href="/api/auth/tiktok/start"
              className="text-sm rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Reconectar
            </a>
            <button
              type="button"
              onClick={disconnect}
              disabled={pending}
              className="text-sm rounded-md border border-red-300 dark:border-red-900 text-red-700 dark:text-red-300 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
            >
              {pending ? "Desconectando…" : "Desconectar"}
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function ThreadsSection({
  account,
  status,
}: {
  account: ThreadsAccountInfo;
  status?: { ok?: boolean; error?: string };
}) {
  const [pending, startTransition] = useTransition();
  const [now] = useState(() => Date.now());

  function disconnect() {
    if (!account) return;
    if (!confirm(`Desconectar @${account.username}? Posts com status_th=queued vão parar de sair até reconectar.`)) return;
    startTransition(async () => {
      await disconnectThreadsAccount(account.id);
    });
  }

  const expires = account?.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
  const daysToExpire = expires ? Math.floor((expires.getTime() - now) / 86_400_000) : null;

  return (
    <Section
      title="Threads (API direta)"
      description="Conexão OAuth com seu perfil pessoal do Threads. Posts com status_th=queued e auto_publish=true são publicados via Threads Content Publishing API."
    >
      {status?.ok && (
        <div className="text-xs rounded-md px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
          ✓ Conta conectada com sucesso.
        </div>
      )}
      {status?.error && (
        <div className="text-xs rounded-md px-3 py-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
          ✗ {status.error}
        </div>
      )}

      {!account ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Nenhuma conta conectada. Conectar abre a tela de autorização do Threads — scopes{" "}
            <code className="font-mono">threads_basic</code> +{" "}
            <code className="font-mono">threads_content_publish</code>.
          </p>
          <a
            href="/api/auth/threads/start"
            className="self-start text-sm rounded-md bg-neutral-900 text-white px-4 py-2 hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Conectar Threads
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3 text-sm space-y-1">
            <div>
              <span className="text-neutral-500">Conta:</span>{" "}
              <span className="font-medium">@{account.username}</span>
            </div>
            <div className="text-xs text-neutral-500">
              <code className="font-mono">{account.threadsUserId}</code>
            </div>
            {expires && (
              <div className="text-xs text-neutral-500">
                Token expira em {expires.toLocaleString("pt-BR")}
                {daysToExpire !== null && ` (~${daysToExpire} dias)`}
              </div>
            )}
            {account.scope && (
              <div className="text-xs text-neutral-500">
                Scopes: <code className="font-mono">{account.scope}</code>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <a
              href="/api/auth/threads/start"
              className="text-sm rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Reconectar
            </a>
            <button
              type="button"
              onClick={disconnect}
              disabled={pending}
              className="text-sm rounded-md border border-red-300 dark:border-red-900 text-red-700 dark:text-red-300 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
            >
              {pending ? "Desconectando…" : "Desconectar"}
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function StagingSection({ staging_dir }: { staging_dir: string }) {
  const [value, setValue] = useState(staging_dir);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await saveStaging(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <Section
      title="Pasta de staging"
      description="Onde o importador (M2) busca mídias quando o YAML usa caminhos relativos."
    >
      <Field
        label="Caminho relativo à raiz do repo"
        value={value}
        onChange={setValue}
        placeholder="staging"
        mono
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="text-sm rounded-md bg-neutral-900 text-white px-3 py-1.5 hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {saved ? "Salvo ✓" : pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}
