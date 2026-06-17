"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPostAction } from "@/app/actions";
import type { PostType } from "@/lib/posts";

type Preview = { file: File; url: string };

type AccountOption = { id: string; name: string; is_default: boolean };

type DefaultsHint = {
  type: PostType;
  auto_publish: boolean;
};

const TYPE_LABELS: Record<PostType, string> = {
  single: "Imagem única",
  carousel: "Carrossel",
  reel: "Reel (vídeo)",
  story: "Story",
};

const TYPE_OPTIONS: PostType[] = ["single", "carousel", "reel", "story"];

export function NewPostForm({
  defaultDate,
  accounts,
  defaults,
}: {
  defaultDate: string;
  accounts: AccountOption[];
  defaults: DefaultsHint;
}) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PostType>(defaults.type);
  const [autoPublish, setAutoPublish] = useState<boolean>(defaults.auto_publish);
  const [accountId, setAccountId] = useState<string>("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews((prev) => [...prev, ...incoming]);
  }

  function removeAt(idx: number) {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function moveLeft(idx: number) {
    if (idx === 0) return;
    setPreviews((prev) => {
      const copy = [...prev];
      [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
      return copy;
    });
  }

  function moveRight(idx: number) {
    setPreviews((prev) => {
      if (idx >= prev.length - 1) return prev;
      const copy = [...prev];
      [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
      return copy;
    });
  }

  function submit() {
    setError(null);
    if (previews.length === 0) {
      setError("Envie ao menos uma imagem.");
      return;
    }
    const formData = new FormData();
    formData.set("date", date);
    formData.set("title", title);
    formData.set("type", type);
    formData.set("auto_publish", autoPublish ? "true" : "false");
    if (accountId) formData.set("account_id", accountId);
    previews.forEach((p, idx) => {
      const ext = p.file.name.split(".").pop() ?? "jpg";
      const renamed = `${String(idx + 1).padStart(2, "0")}.${ext}`;
      formData.append("images", new File([p.file], renamed, { type: p.file.type }));
    });
    startTransition(async () => {
      try {
        const slug = await createPostAction(formData);
        router.push(`/post/${slug}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-neutral-500">Título curto (vira o slug)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex: dica de produtividade"
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">Tipo</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PostType)}
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
            onChange={(e) => setAccountId(e.target.value)}
            disabled={accounts.length === 0}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="">
              {accounts.length === 0 ? "Configure em /settings" : "Padrão"}
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm sm:self-end sm:pb-1.5">
          <input
            type="checkbox"
            checked={autoPublish}
            onChange={(e) => setAutoPublish(e.target.checked)}
          />
          <span>Publicar sozinho no horário</span>
        </label>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center"
      >
        <p className="text-sm text-neutral-500 mb-3">
          Arraste imagens aqui ou
        </p>
        <label className="inline-block rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800">
          escolher arquivos
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {previews.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {previews.map((p, idx) => (
            <li
              key={p.url}
              className="relative rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="w-full aspect-square object-cover" />
              <span className="absolute top-1 left-1 rounded bg-black/60 text-white text-xs px-1.5 py-0.5">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="absolute bottom-1 right-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => moveLeft(idx)}
                  disabled={idx === 0}
                  className="rounded bg-black/60 text-white text-xs px-1.5 py-0.5 disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => moveRight(idx)}
                  disabled={idx === previews.length - 1}
                  className="rounded bg-black/60 text-white text-xs px-1.5 py-0.5 disabled:opacity-30"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  className="rounded bg-red-600/80 text-white text-xs px-1.5 py-0.5"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Criando…" : "Criar post"}
        </button>
      </div>
    </div>
  );
}
