"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useUser } from "@clerk/nextjs";
import YAML from "yaml";

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const VIDEO_RE = /\.(mp4|mov|m4v)$/i;
const YAML_NAMES = ["post.yaml", "post.yml"];

type MediaKind = "image" | "video";

type DetectedPost =
  | {
      kind: "ok";
      relPath: string;
      yamlFile: File;
      mediaFiles: { file: File; kind: MediaKind }[];
    }
  | {
      kind: "error";
      relPath: string;
      message: string;
    };

type Outcome = {
  state: "idle" | "uploading" | "creating" | "ok" | "error";
  progress?: { uploaded: number; total: number };
  slug?: string;
  error?: string;
};

function relParts(file: File): string[] {
  // input[webkitdirectory] entrega file.webkitRelativePath = "selected-folder/sub-folder/file.ext"
  const rel = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath ?? file.name;
  return rel.split("/");
}

function classify(filename: string): MediaKind | null {
  if (IMAGE_RE.test(filename)) return "image";
  if (VIDEO_RE.test(filename)) return "video";
  return null;
}

function groupFiles(files: File[]): DetectedPost[] {
  const byFolder = new Map<string, File[]>();
  for (const f of files) {
    const parts = relParts(f);
    if (parts.length < 3) continue; // need <root>/<post-folder>/<file>
    if (parts.some((p) => p.startsWith("."))) continue; // skip hidden / .imported / etc.
    const folder = parts.slice(0, -1).join("/");
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder)!.push(f);
  }
  const posts: DetectedPost[] = [];
  for (const [folder, items] of byFolder) {
    const relPath = folder.split("/").slice(1).join("/") || folder; // drop root
    const yaml = items.find((f) => YAML_NAMES.includes(f.name.toLowerCase()));
    if (!yaml) {
      posts.push({ kind: "error", relPath, message: "post.yaml não encontrado" });
      continue;
    }
    const media = items
      .filter((f) => !YAML_NAMES.includes(f.name.toLowerCase()))
      .map((f) => ({ file: f, kind: classify(f.name) }))
      .filter((m): m is { file: File; kind: MediaKind } => m.kind !== null)
      .sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true }));
    if (media.length === 0) {
      posts.push({ kind: "error", relPath, message: "nenhuma mídia válida" });
      continue;
    }
    posts.push({ kind: "ok", relPath, yamlFile: yaml, mediaFiles: media });
  }
  return posts.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

async function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function ImportView() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [detected, setDetected] = useState<DetectedPost[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [running, setRunning] = useState(false);
  const [folderLabel, setFolderLabel] = useState<string>("");
  const { user } = useUser();

  function onSelectFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const root = relParts(files[0])[0] ?? "selecionada";
    setFolderLabel(root);
    const posts = groupFiles(files);
    setDetected(posts);
    setOutcomes({});
  }

  async function runOne(post: DetectedPost): Promise<Outcome> {
    if (post.kind === "error") {
      return { state: "error", error: post.message };
    }
    const total = post.mediaFiles.length;
    let uploaded = 0;
    setOutcomes((prev) => ({
      ...prev,
      [post.relPath]: { state: "uploading", progress: { uploaded: 0, total } },
    }));

    let frontmatter: unknown;
    try {
      const text = await readText(post.yamlFile);
      frontmatter = YAML.parse(text);
    } catch (e) {
      return { state: "error", error: `YAML inválido: ${e instanceof Error ? e.message : String(e)}` };
    }

    const slug = `${(frontmatter as { date?: string }).date ?? "post"}-${(frontmatter as { title?: string }).title ?? "post"}`
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    const media: {
      filename: string;
      kind: MediaKind;
      url: string;
      sizeBytes: number;
      contentType: string;
    }[] = [];

    if (!user?.id) {
      return { state: "error", error: "usuário não carregado" };
    }
    const userId = user.id;

    for (const [idx, m] of post.mediaFiles.entries()) {
      const ext = m.file.name.split(".").pop() ?? "bin";
      const filename = `${String(idx + 1).padStart(2, "0")}.${ext}`;
      try {
        const blob = await upload(`media/${userId}/${slug}/${filename}`, m.file, {
          access: "public",
          handleUploadUrl: "/api/blob/upload-token",
          contentType: m.file.type || undefined,
        });
        media.push({
          filename,
          kind: m.kind,
          url: blob.url,
          sizeBytes: m.file.size,
          contentType: m.file.type || "application/octet-stream",
        });
      } catch (e) {
        return {
          state: "error",
          error: `upload ${m.file.name}: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
      uploaded += 1;
      setOutcomes((prev) => ({
        ...prev,
        [post.relPath]: {
          state: "uploading",
          progress: { uploaded, total },
        },
      }));
    }

    setOutcomes((prev) => ({
      ...prev,
      [post.relPath]: { state: "creating", progress: { uploaded, total } },
    }));

    try {
      const res = await fetch("/api/import/one", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frontmatter, media }),
      });
      const json = (await res.json()) as { ok: boolean; slug?: string; error?: string };
      if (!json.ok) {
        return { state: "error", error: json.error ?? "erro desconhecido" };
      }
      return { state: "ok", slug: json.slug, progress: { uploaded, total } };
    } catch (e) {
      return { state: "error", error: e instanceof Error ? e.message : String(e) };
    }
  }

  async function runAll() {
    if (running) return;
    setRunning(true);
    for (const post of detected) {
      const result = await runOne(post);
      setOutcomes((prev) => ({ ...prev, [post.relPath]: result }));
    }
    setRunning(false);
  }

  function reset() {
    setDetected([]);
    setOutcomes({});
    setFolderLabel("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const okCount = detected.filter((p) => p.kind === "ok").length;
  const doneCount = Object.values(outcomes).filter((o) => o.state === "ok").length;
  const errCount = Object.values(outcomes).filter((o) => o.state === "error").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2 rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800">
          Selecionar pasta
          <input
            ref={inputRef}
            type="file"
            // @ts-expect-error webkitdirectory is non-standard but supported in major browsers
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={onSelectFolder}
          />
        </label>
        {folderLabel && (
          <span className="text-sm text-neutral-500">
            pasta: <code className="font-mono">{folderLabel}</code> · {detected.length} item(s) · {okCount}{" "}
            válido(s){doneCount > 0 && ` · ${doneCount} importado(s)`}
            {errCount > 0 && ` · ${errCount} erro(s)`}
          </span>
        )}
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={reset}
            disabled={running || detected.length === 0}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={runAll}
            disabled={running || okCount === 0}
            className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-1.5 hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {running ? "Importando…" : "Importar tudo"}
          </button>
        </div>
      </div>

      {detected.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-sm text-neutral-500">
          Selecione uma pasta no botão acima. Cada sub-pasta deve conter{" "}
          <code className="font-mono">post.yaml</code> + as mídias.
        </div>
      ) : (
        <ul className="space-y-2">
          {detected.map((post) => {
            const outcome = outcomes[post.relPath];
            return (
              <li
                key={post.relPath}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono truncate">{post.relPath}</div>
                    {post.kind === "ok" ? (
                      <div className="text-xs text-neutral-500 mt-1">
                        {post.mediaFiles.length} mídia(s)
                      </div>
                    ) : (
                      <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {post.message}
                      </div>
                    )}
                    {outcome && <StatusLine outcome={outcome} />}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusLine({ outcome }: { outcome: Outcome }) {
  if (outcome.state === "idle") return null;
  if (outcome.state === "uploading") {
    return (
      <div className="text-xs text-neutral-500 mt-1">
        subindo mídias {outcome.progress?.uploaded}/{outcome.progress?.total}…
      </div>
    );
  }
  if (outcome.state === "creating") {
    return <div className="text-xs text-neutral-500 mt-1">criando post…</div>;
  }
  if (outcome.state === "ok") {
    return (
      <div className="text-xs text-green-700 dark:text-green-400 mt-1">
        importado →{" "}
        <Link href={`/post/${outcome.slug}`} className="underline">
          {outcome.slug}
        </Link>
      </div>
    );
  }
  return (
    <div className="text-xs text-red-600 dark:text-red-400 mt-1">Erro: {outcome.error}</div>
  );
}
