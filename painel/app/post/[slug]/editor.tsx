"use client";

import { useState, useTransition } from "react";
import {
  publishInstagramAction,
  saveCaption,
  saveSchedule,
  updateStatus,
} from "@/app/actions";
import type { NetworkStatus, PostMeta } from "@/lib/posts";

const STATUS_LABELS: Record<NetworkStatus, string> = {
  queued: "Na fila",
  posted: "Publicado",
  skipped: "Pulado",
};

const STATUS_OPTIONS: NetworkStatus[] = ["queued", "posted", "skipped"];

const IG_COMPOSER = "https://www.instagram.com/";
const LI_COMPOSER = "https://www.linkedin.com/feed/?shareActive=true";

export function PostEditor({
  slug,
  initial,
}: {
  slug: string;
  initial: { captionIg: string; captionLi: string; meta: PostMeta };
}) {
  const [scheduled, setScheduled] = useState(initial.meta.scheduled ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Agendar para</span>
          <input
            type="datetime-local"
            value={scheduled.slice(0, 16)}
            onChange={(e) => setScheduled(e.target.value)}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await saveSchedule(slug, scheduled);
            })
          }
          className="rounded-md bg-neutral-900 text-white text-sm px-3 py-1.5 hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Salvar horário
        </button>
      </div>

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
      </div>
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
  network: "ig" | "li";
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
      if (dirty) await saveCaption(slug, "ig", caption);
      const { postId } = await publishInstagramAction(slug);
      setPublishedId(postId);
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

      {network === "ig" && status !== "posted" && (
        <div className="rounded-md bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 p-3 space-y-2">
          <p className="text-xs text-neutral-500">
            Publicação automática via Graph API (upload no Blob → IG)
          </p>
          <button
            type="button"
            disabled={publishing || pending}
            onClick={handleAutoPublish}
            className="w-full rounded-md bg-pink-600 text-white text-sm font-medium px-3 py-2 hover:bg-pink-700 disabled:opacity-50"
          >
            {publishing ? "Publicando…" : "🚀 Publicar no Instagram"}
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
