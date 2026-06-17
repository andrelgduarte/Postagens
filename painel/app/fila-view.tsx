"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { bulkDelete, bulkSetAccount, bulkSetAutoPublish } from "@/app/actions";
import { imageUrl } from "@/lib/media-url";

type NetworkStatus = "queued" | "posted" | "skipped" | "failed";
type PostType = "single" | "carousel" | "reel" | "story";

const TYPE_LABEL: Record<PostType, string> = {
  single: "imagem",
  carousel: "carrossel",
  reel: "reel",
  story: "story",
};

type PostCard = {
  slug: string;
  date: string;
  title: string;
  images: string[];
  videos: string[];
  meta: {
    type?: PostType;
    scheduled?: string;
    status_ig: NetworkStatus;
    status_li: NetworkStatus;
    auto_publish?: boolean;
  };
};

type AccountOption = { id: string; name: string };

export function FilaView({
  upcoming,
  past,
  accounts,
}: {
  upcoming: PostCard[];
  past: PostCard[];
  accounts: AccountOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [accountToSet, setAccountToSet] = useState("");

  const total = upcoming.length + past.length;
  const allSlugs = useMemo(() => [...upcoming, ...past].map((p) => p.slug), [upcoming, past]);

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allSlugs));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function runAutoPublish(value: boolean) {
    const slugs = Array.from(selected);
    startTransition(async () => {
      await bulkSetAutoPublish(slugs, value);
      setSelected(new Set());
    });
  }

  function runSetAccount() {
    if (!accountToSet) return;
    const slugs = Array.from(selected);
    startTransition(async () => {
      await bulkSetAccount(slugs, accountToSet);
      setSelected(new Set());
      setAccountToSet("");
    });
  }

  function runDelete() {
    const slugs = Array.from(selected);
    if (!confirm(`Excluir ${slugs.length} post(s)? Mídias do Blob também serão removidas.`)) return;
    startTransition(async () => {
      await bulkDelete(slugs);
      setSelected(new Set());
    });
  }

  return (
    <>
      <div className="space-y-10">
        <Section
          title="Agendados / hoje"
          posts={upcoming}
          selected={selected}
          onToggle={toggle}
        />
        <Section
          title="Publicados / passados"
          posts={past}
          selected={selected}
          onToggle={toggle}
        />
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
          <div className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl px-4 py-3 flex flex-wrap items-center gap-3 max-w-3xl">
            <span className="text-sm font-medium">{selected.size} de {total} selecionado(s)</span>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
            >
              tudo
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
            >
              limpar
            </button>
            <div className="h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
            <button
              type="button"
              disabled={pending}
              onClick={() => runAutoPublish(true)}
              className="text-xs rounded-md border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-2 py-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50"
            >
              ✓ auto-publicar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => runAutoPublish(false)}
              className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              ✗ auto-publicar
            </button>
            <div className="flex items-center gap-1">
              <select
                value={accountToSet}
                disabled={pending || accounts.length === 0}
                onChange={(e) => setAccountToSet(e.target.value)}
                className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1"
              >
                <option value="">conta…</option>
                <option value="__default__">— padrão —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={runSetAccount}
                disabled={pending || !accountToSet}
                className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
              >
                aplicar
              </button>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={runDelete}
              className="text-xs rounded-md border border-red-300 text-red-700 dark:text-red-400 dark:border-red-800 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
            >
              {pending ? "…" : "🗑 excluir"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  posts,
  selected,
  onToggle,
}: {
  title: string;
  posts: PostCard[];
  selected: Set<string>;
  onToggle: (slug: string) => void;
}) {
  if (posts.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm uppercase tracking-wider text-neutral-500 font-medium">{title}</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((p) => (
          <li key={p.slug}>
            <Card post={p} checked={selected.has(p.slug)} onToggle={() => onToggle(p.slug)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Card({
  post,
  checked,
  onToggle,
}: {
  post: PostCard;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`relative group block rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden hover:shadow-md transition-shadow ${
        checked
          ? "border-neutral-900 dark:border-white ring-2 ring-neutral-900 dark:ring-white"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        className="absolute top-2 left-2 z-10 w-5 h-5 rounded bg-white/90 dark:bg-neutral-900/90 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center cursor-pointer"
        aria-label={checked ? "Desselecionar" : "Selecionar"}
      >
        {checked && <span className="text-xs">✓</span>}
      </button>
      <Link href={`/post/${post.slug}`} className="block">
        <div className="aspect-square bg-neutral-100 dark:bg-neutral-800 relative overflow-hidden">
          {post.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(post.slug, post.images[0])}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
            />
          ) : post.videos[0] ? (
            <video
              src={`${imageUrl(post.slug, post.videos[0])}#t=0.5`}
              preload="metadata"
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 text-sm">
              sem mídia
            </div>
          )}
          {post.meta.type && (
            <span className="absolute top-2 right-12 rounded bg-black/60 text-white text-xs px-1.5 py-0.5">
              {TYPE_LABEL[post.meta.type]}
            </span>
          )}
          {post.images.length > 1 && (
            <span className="absolute top-2 right-2 rounded bg-black/60 text-white text-xs px-1.5 py-0.5">
              {post.images.length} imgs
            </span>
          )}
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono text-neutral-500">{post.date}</span>
            {post.meta.scheduled && (
              <span className="text-xs text-neutral-400">
                {post.meta.scheduled.slice(11, 16) || ""}
              </span>
            )}
          </div>
          <h3 className="font-medium text-sm line-clamp-1">{post.title}</h3>
          <div className="flex flex-wrap gap-1">
            <StatusBadge label="IG" status={post.meta.status_ig} />
            <StatusBadge label="LI" status={post.meta.status_li} />
            {post.meta.auto_publish && (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                auto
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

function StatusBadge({ label, status }: { label: string; status: NetworkStatus }) {
  const color =
    status === "posted"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "skipped"
        ? "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
        : status === "failed"
          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${color}`}>
      {label} · {status}
    </span>
  );
}
