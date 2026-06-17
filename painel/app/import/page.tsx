import { scanStaging, stagingRoot } from "@/lib/import";
import { ImportView } from "./view";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [entries, root] = await Promise.all([scanStaging(), stagingRoot()]);
  const serializable = entries.map((e) =>
    e.kind === "ok"
      ? {
          kind: "ok" as const,
          relPath: e.relPath,
          title: e.frontmatter.title,
          date: e.frontmatter.date,
          type: e.frontmatter.type,
          mediaCount: e.mediaFiles.length,
          autoPublish: e.frontmatter.auto_publish ?? false,
          time: e.frontmatter.time,
        }
      : {
          kind: "error" as const,
          relPath: e.relPath,
          message: e.message,
        }
  );
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar de staging/</h1>
        <p className="text-sm text-neutral-500">
          Drop em <code className="font-mono">{root}</code> (uma pasta por post com{" "}
          <code className="font-mono">post.yaml</code> + mídias). Após importar, a pasta vai para{" "}
          <code className="font-mono">staging/.imported/</code>.
        </p>
      </div>
      <ImportView entries={serializable} />
    </div>
  );
}
