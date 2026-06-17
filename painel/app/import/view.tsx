"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { importAllAction, importOneAction } from "./actions";

type EntryPreview =
  | {
      kind: "ok";
      relPath: string;
      title: string;
      date: string;
      type?: "single" | "carousel" | "reel" | "story";
      mediaCount: number;
      autoPublish: boolean;
      time?: string;
    }
  | {
      kind: "error";
      relPath: string;
      message: string;
    };

type Outcome = { slug?: string; error?: string };

export function ImportView({ entries }: { entries: EntryPreview[] }) {
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [pending, startTransition] = useTransition();

  function runOne(relPath: string) {
    startTransition(async () => {
      const result = await importOneAction(relPath);
      setOutcomes((prev) => ({
        ...prev,
        [relPath]: { slug: result.slug, error: result.error },
      }));
    });
  }

  function runAll() {
    startTransition(async () => {
      const results = await importAllAction();
      const next: Record<string, Outcome> = {};
      for (const r of results) next[r.relPath] = { slug: r.slug, error: r.error };
      setOutcomes(next);
    });
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-sm text-neutral-500">
        Nada em staging.
      </div>
    );
  }

  const okCount = entries.filter((e) => e.kind === "ok").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {entries.length} pasta(s) · {okCount} válida(s)
        </p>
        <button
          type="button"
          onClick={runAll}
          disabled={pending || okCount === 0}
          className="rounded-md bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Importando…" : "Importar tudo"}
        </button>
      </div>

      <ul className="space-y-2">
        {entries.map((entry) => {
          const outcome = outcomes[entry.relPath];
          return (
            <li
              key={entry.relPath}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="font-mono text-neutral-500">{entry.relPath}</span>
                  {entry.kind === "ok" && (
                    <>
                      <span>·</span>
                      <span>{entry.title}</span>
                    </>
                  )}
                </div>
                {entry.kind === "ok" ? (
                  <div className="text-xs text-neutral-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{entry.date}{entry.time ? ` ${entry.time}` : ""}</span>
                    <span>{entry.type ?? (entry.mediaCount >= 2 ? "carousel" : "single")}</span>
                    <span>{entry.mediaCount} mídia(s)</span>
                    {entry.autoPublish && <span>auto-publish</span>}
                  </div>
                ) : (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{entry.message}</p>
                )}
                {outcome?.slug && (
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                    Importado →{" "}
                    <Link href={`/post/${outcome.slug}`} className="underline">
                      {outcome.slug}
                    </Link>
                  </p>
                )}
                {outcome?.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Erro: {outcome.error}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => runOne(entry.relPath)}
                disabled={pending || entry.kind === "error"}
                className="rounded-md border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40"
              >
                Importar
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
