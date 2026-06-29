"use client";

import { useState, useTransition } from "react";
import {
  publishInstagramAction,
  publishLinkedInAction,
  publishTikTokAction,
  resetRetry,
  saveAccount,
  saveAutoPublish,
  saveCaption,
  saveSchedule,
  saveType,
  updateStatus,
} from "@/app/actions";
import type { NetworkStatus, PostMeta, PostType } from "@/lib/posts";

const STATUS_LABELS: Record<NetworkStatus, string> = {
  queued: "Na fila",
  posted: "Publicado",
  skipped: "Pulado",
  failed: "Falhou",
};

const STATUS_OPTIONS: NetworkStatus[] = ["queued", "posted", "skipped", "failed"];

const TYPE_LABELS: Record<PostType, string> = {
  single: "Imagem única",
  carousel: "Carrossel",
  reel: "Reel (vídeo)",
  story: "Story",
};

const TYPE_OPTIONS: PostType[] = ["single", "carousel", "reel", "story"];

const IG_COMPOSER = "https://www.instagram.com/";
const LI_COMPOSER = "https://www.linkedin.com/feed/?shareActive=true";
const TT_COMPOSER = "https://www.tiktok.com/upload";

type AccountOption = { id: string; name: string; is_default: boolean };

export function PostEditor({
  slug,
  accounts,
  initial,
}: {
  slug: string;
  accounts: AccountOption[];
  initial: { captionIg: string; captionLi: string; captionTt: string; meta: PostMeta };
}) {
  const [scheduled, setScheduled] = useState(initial.meta.scheduled ?? "");
  const [type, setType] = useState<PostType>(initial.meta.type ?? "single");
  const [autoPublish, setAutoPublish] = useState<boolean>(
    initial.meta.auto_publish ?? false
  );
  const [accountId, setAccountId] = useState<string>(initial.meta.account_id ?? "");
  const [pending, startTransition] = useTransition();

  const defaultAccountName =
    accounts.find((a) => a.is_default)?.name ?? accounts[0]?.name ?? "";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Agendar para</span>
          <input
            type="datetime-local"
            value={scheduled.slice(0, 16)}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              setScheduled(v);
              startTransition(async () => {
                await saveSchedule(slug, v);
              });
            }}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Tipo</span>
          <select
            value={type}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value as PostType;
              setType(next);
              startTransition(async () => {
                await saveType(slug, next);
              });
            }}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Conta IG</span>
          <select
            value={accountId}
            disabled={pending || accounts.length === 0}
            onChange={(e) => {
              const v = e.target.value;
              setAccountId(v);
              startTransition(async () => {
                await saveAccount(slug, v);
              });
            }}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="">
              {accounts.length === 0
                ? "Configure em /settings"
                : `Padrão${defaultAccountName ? ` (${defaultAccountName})` : ""}`}
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-1 lg:self-end lg:pb-1.5">
          <input
            type="checkbox"
            checked={autoPublish}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.checked;
              setAutoPublish(v);
              startTransition(async () => {
                await saveAutoPublish(slug, v);
              });
            }}
          />
          <span>Publicar sozinho no horário</span>
        </label>
      </div>

      <StatusDetail slug={slug} meta={initial.meta} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NetworkPanel
          slug={slug}
          network="ig"
          label="Instagram"
          initialCaption={initial.captionIg}
          initialStatus={initial.meta.status_ig}
          composerUrl={IG_COMPOSER}
          igPostId={initial.meta.ig_post_id}
        />
        <NetworkPanel
          slug={slug}
          network="li"
          label="LinkedIn"
          initialCaption={initial.captionLi}
          initialStatus={initial.meta.status_li}
          composerUrl={LI_COMPOSER}
        />
        <NetworkPanel
          slug={slug}
          network="tt"
          label="TikTok"
          initialCaption={initial.captionTt}
          initialStatus={initial.meta.status_tt}
          composerUrl={TT_COMPOSER}
        />
      </div>
    </div>
  );
}

function StatusDetail({ slug, meta }: { slug: string; meta: PostMeta }) {
  const [pending, startTransition] = useTransition();
  const hasInfo =
    meta.attempts !== undefined ||
    meta.last_attempt ||
    meta.last_error ||
    meta.published_at ||
    meta.ig_post_id;
  if (!hasInfo) return null;

  const failed = meta.status_ig === "failed";

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Status técnico (Instagram)
        </h3>
        {failed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Reabrir esse post para nova tentativa?")) return;
              startTransition(async () => {
                await resetRetry(slug);
              });
            }}
            className="rounded-md bg-amber-600 text-white text-xs px-3 py-1 hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? "Resetando…" : "Tentar novamente"}
          </button>
        )}
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {meta.published_at && (
          <Row label="Publicado em">
            <span className="font-mono">{new Date(meta.published_at).toLocaleString("pt-BR")}</span>
          </Row>
        )}
        {meta.ig_post_id && (
          <Row label="IG post ID">
            <span className="font-mono">{meta.ig_post_id}</span>
          </Row>
        )}
        {meta.attempts !== undefined && meta.attempts > 0 && (
          <Row label="Tentativas">
            <span>{meta.attempts}</span>
          </Row>
        )}
        {meta.last_attempt && (
          <Row label="Última tentativa">
            <span className="font-mono">{new Date(meta.last_attempt).toLocaleString("pt-BR")}</span>
          </Row>
        )}
        {meta.last_error && (
          <Row label="Último erro" wide>
            <span className="text-red-700 dark:text-red-400 break-words">{meta.last_error}</span>
          </Row>
        )}
      </dl>
    </div>
  );
}

function Row({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2 flex flex-col gap-0.5" : "flex flex-col gap-0.5"}>
      <dt className="text-neutral-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function NetworkPanel({
  slug,
  network,
  label,
  initialCaption,
  initialStatus,
  composerUrl,
  igPostId,
}: {
  slug: string;
  network: "ig" | "li" | "tt";
  label: string;
  initialCaption: string;
  initialStatus: NetworkStatus;
  composerUrl: string;
  igPostId?: string;
}) {
  const [caption, setCaption] = useState(initialCaption);
  const [status, setStatus] = useState<NetworkStatus>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | undefined>(igPostId);

  const dirty = caption !== initialCaption;

  async function handleAutoPublish() {
    setPublishError(null);
    setPublishing(true);
    try {
      if (dirty) await saveCaption(slug, network, caption);
      if (network === "ig") {
        const { postId } = await publishInstagramAction(slug);
        setPublishedId(postId);
      } else if (network === "li") {
        await publishLinkedInAction(slug);
      } else {
        await publishTikTokAction(slug);
      }
      setStatus("posted");
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{label}</h2>
        <select
          value={status}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as NetworkStatus;
            setStatus(next);
            startTransition(async () => {
              await updateStatus(slug, network, next);
            });
          }}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-xs"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={12}
        placeholder={`Legenda para ${label}…`}
        className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent p-3 text-sm font-mono leading-relaxed resize-y"
      />
      <p className="text-xs text-neutral-500">{caption.length} caracteres</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={() =>
            startTransition(async () => {
              await saveCaption(slug, network, caption);
            })
          }
          className="rounded-md bg-neutral-900 text-white text-sm px-3 py-1.5 hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {dirty ? "Salvar legenda" : "Salvo"}
        </button>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(caption);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 text-sm px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          {copied ? "Copiado ✓" : "Copiar legenda"}
        </button>
        <a
          href={composerUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 text-sm px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          Abrir {label} ↗
        </a>
        {status !== "posted" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setStatus("posted");
              startTransition(async () => {
                await updateStatus(slug, network, "posted");
              });
            }}
            className="ml-auto rounded-md bg-emerald-600 text-white text-sm px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-50"
          >
            Marcar como publicado
          </button>
        )}
      </div>

      {status !== "posted" && (
        <div className="rounded-md bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 p-3 space-y-2">
          <p className="text-xs text-neutral-500">
            {network === "ig"
              ? "Publicação automática via Graph API (upload no Blob → IG)"
              : network === "li"
                ? "Publicação automática via LinkedIn API (perfil pessoal)"
                : "Envio pro inbox/drafts do TikTok — abra o app pra finalizar"}
          </p>
          <button
            type="button"
            disabled={publishing || pending}
            onClick={handleAutoPublish}
            className={`w-full rounded-md text-white text-sm font-medium px-3 py-2 disabled:opacity-50 ${
              network === "ig"
                ? "bg-pink-600 hover:bg-pink-700"
                : network === "li"
                  ? "bg-sky-700 hover:bg-sky-800"
                  : "bg-neutral-900 hover:bg-neutral-700"
            }`}
          >
            {publishing
              ? "Publicando…"
              : network === "ig"
                ? "🚀 Publicar no Instagram"
                : network === "li"
                  ? "🚀 Publicar no LinkedIn"
                  : "🚀 Enviar pro TikTok"}
          </button>
          {publishError && (
            <p className="text-xs text-red-600 dark:text-red-400 break-words">{publishError}</p>
          )}
        </div>
      )}

      {network === "ig" && publishedId && (
        <p className="text-xs text-neutral-500 font-mono">
          IG post id: {publishedId}
        </p>
      )}
    </section>
  );
}
