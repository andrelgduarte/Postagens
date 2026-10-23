/**
 * Organiza os posts de LinkedIn do André (C:\postagens\linkedin\verzel_hub_linkedin.yaml)
 * no formato de staging do sistema: staging/andre-li/<slug>/ com as mídias + post.yaml.
 *
 * - Segura posts com lacunas [ ] e os que aguardam foto (li_09, li_22).
 * - Carrossel = multi-imagem (usa os PNGs; o PDF é ignorado).
 * - post.yaml usa o schema do importador + platforms: ["li"] (só LinkedIn).
 *
 * Uso: tsx scripts/_stage-andre-linkedin.ts            (gera a pasta staging/andre-li)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";

// Mesma implementação de lib/posts.slugify (inline para não puxar o client do DB).
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const YAML_PATH = process.env.ANDRE_LI_YAML || "C:/postagens/linkedin/verzel_hub_linkedin.yaml";
const MEDIA_DIR = process.env.ANDRE_LI_MEDIA || "C:/postagens/linkedin";
const OUT_DIR = path.resolve(process.cwd(), "staging", "andre-li");

const PHOTO_PENDING = new Set(["li_09", "li_22"]);
const IMG_RE = /\.(jpe?g|png|webp)$/i;
const PLACEHOLDER_RE = /\[[^\]]+\]/;

type YamlPost = {
  id: string;
  date: string;
  time?: string;
  titulo_interno: string;
  imagem?: string;
  imagens?: string[];
  caption_li?: string;
  primeiro_comentario?: string;
};

function heldReason(p: YamlPost): string | null {
  if (PHOTO_PENDING.has(p.id)) return "aguarda foto do André";
  if (p.caption_li && PLACEHOLDER_RE.test(p.caption_li)) return "lacuna [ ] na legenda";
  if (p.primeiro_comentario && PLACEHOLDER_RE.test(p.primeiro_comentario))
    return "lacuna [ ] no 1º comentário (link do artigo)";
  return null;
}

function mediaFilesFor(p: YamlPost): string[] {
  if (p.imagens && p.imagens.length > 0) return p.imagens;
  if (p.imagem && IMG_RE.test(p.imagem)) return [p.imagem];
  return [];
}

async function main() {
  const raw = await fs.readFile(YAML_PATH, "utf8");
  const docs = YAML.parse(raw) as YamlPost[];
  if (!Array.isArray(docs)) throw new Error("YAML não é uma lista de posts");

  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  let staged = 0;
  let held = 0;
  const errors: string[] = [];

  for (const p of docs) {
    const reason = heldReason(p);
    if (reason) {
      held += 1;
      console.log(`  ⏸  ${p.id} segurado — ${reason}`);
      continue;
    }

    const files = mediaFilesFor(p);
    const slug = `${p.date}-${slugify(p.titulo_interno) || "post"}`;
    const dir = path.join(OUT_DIR, slug);
    await fs.mkdir(dir, { recursive: true });

    const stagedNames: string[] = [];
    let i = 0;
    for (const f of files) {
      i += 1;
      const ext = path.extname(f).toLowerCase();
      const name = `${String(i).padStart(2, "0")}${ext}`;
      try {
        await fs.copyFile(path.join(MEDIA_DIR, f), path.join(dir, name));
        stagedNames.push(name);
      } catch (e) {
        errors.push(`${p.id}: falha ao copiar ${f}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const fm: Record<string, unknown> = {
      date: p.date,
      title: p.titulo_interno,
      type: files.length >= 2 ? "carousel" : "single",
      time: p.time ?? "18:00",
      auto_publish: true,
      platforms: ["li"],
      caption_li: (p.caption_li ?? "").replace(/\r\n/g, "\n"),
    };
    if (stagedNames.length > 0) fm.images = stagedNames;

    await fs.writeFile(path.join(dir, "post.yaml"), YAML.stringify(fm), "utf8");
    const kind = files.length === 0 ? "texto" : files.length === 1 ? "imagem" : `carrossel ${files.length}`;
    console.log(`  ✓  ${p.id} → ${slug}  [${kind}]`);
    staged += 1;
  }

  console.log(`\nStaging em ${OUT_DIR}`);
  console.log(`Resumo: ${staged} organizado(s) · ${held} segurado(s) · ${errors.length} erro(s)`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
