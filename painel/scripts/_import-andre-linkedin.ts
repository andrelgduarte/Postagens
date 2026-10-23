/**
 * Importa os posts organizados em staging/andre-li/ para o banco, via
 * importFromPayload() do próprio sistema.
 *
 * As mídias são enviadas ao Vercel Blob FORA deste script (via `vercel blob put`,
 * usando a sessão logada) e as URLs públicas resultantes são lidas de um mapa JSON
 * — assim não precisamos do BLOB_READ_WRITE_TOKEN (que é "sensitive" e não baixa).
 *
 * Idempotente: pula slug que já existe para o usuário.
 *
 * Uso:
 *   tsx --env-file=.env.production.local scripts/_import-andre-linkedin.ts --user=<id>           # dry-run
 *   tsx --env-file=.env.production.local scripts/_import-andre-linkedin.ts --user=<id> --live    # grava
 *   (ANDRE_LI_BLOBMAP aponta pro JSON { "<slug>": { "<arquivo>": "<url>" } })
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import { posts as postsTable } from "../lib/db/schema";
import { importFromPayload, validateFrontmatter } from "../lib/import";
import { workerUserId } from "../lib/auth";

const STAGE_DIR = path.resolve(process.cwd(), "staging", "andre-li");
const BLOBMAP_PATH = process.env.ANDRE_LI_BLOBMAP || path.join(STAGE_DIR, "_blobmap.json");
const LIVE = process.argv.includes("--live");
const USER_ARG = process.argv.find((a) => a.startsWith("--user="))?.slice("--user=".length);

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type BlobMap = Record<string, Record<string, string>>;

async function loadBlobMap(): Promise<BlobMap> {
  try {
    return JSON.parse(await fs.readFile(BLOBMAP_PATH, "utf8")) as BlobMap;
  } catch {
    return {};
  }
}

async function slugExists(userId: string, slug: string): Promise<boolean> {
  const rows = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.userId, userId), eq(postsTable.slug, slug)))
    .limit(1);
  return rows.length > 0;
}

async function main() {
  const userId = USER_ARG || workerUserId();
  if (userId === "default-user")
    throw new Error("userId resolveu para 'default-user' — passe --user=<clerk_id> do André");

  const blobMap = await loadBlobMap();
  let folders: string[];
  try {
    const dirents = await fs.readdir(STAGE_DIR, { withFileTypes: true });
    folders = dirents.filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch {
    throw new Error(`staging/andre-li ausente — rode scripts/_stage-andre-linkedin.ts primeiro`);
  }

  console.log(`${LIVE ? "LIVE" : "DRY-RUN"} · ${folders.length} pastas · user=${userId}\n`);

  let imported = 0;
  let skippedExisting = 0;
  const errors: string[] = [];

  for (const slug of folders) {
    const dir = path.join(STAGE_DIR, slug);
    let fm;
    try {
      fm = validateFrontmatter(YAML.parse(await fs.readFile(path.join(dir, "post.yaml"), "utf8")));
    } catch (e) {
      errors.push(`${slug}: post.yaml inválido: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const files = fm.images ?? [];
    const media: { filename: string; kind: "image"; url: string; contentType?: string }[] = [];
    let missing = false;
    for (const f of files) {
      const url = blobMap[slug]?.[f];
      if (!url) {
        errors.push(`${slug}: sem URL de Blob para ${f} (rode o upload primeiro)`);
        missing = true;
        continue;
      }
      media.push({ filename: f, kind: "image", url, contentType: CONTENT_TYPE[path.extname(f).toLowerCase()] });
    }
    if (missing) continue;

    if (await slugExists(userId, slug)) {
      skippedExisting += 1;
      console.log(`  ⏭  ${slug} já existe — pulado`);
      continue;
    }

    const kind = files.length === 0 ? "texto" : files.length === 1 ? "imagem" : `carrossel ${files.length}`;
    console.log(`  ✓  ${slug}  [${fm.type} · ${kind}]  ${fm.date} ${fm.time ?? "18:00"}`);

    if (!LIVE) {
      imported += 1;
      continue;
    }

    try {
      await importFromPayload({ frontmatter: fm, media, userId });
      imported += 1;
    } catch (e) {
      errors.push(`${slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(
    `\nResumo: ${imported} ${LIVE ? "importado(s)" : "a importar"} · ${skippedExisting} já existia(m) · ${errors.length} erro(s)`
  );
  for (const e of errors) console.log(`  ✗ ${e}`);
  if (!LIVE) console.log(`\n(dry-run — nada gravado. Rode com --live para efetivar.)`);
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
