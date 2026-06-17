import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { loadConfig } from "./config";
import { createPost, writeCaption, type PostType } from "./posts";

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const VIDEO_RE = /\.(mp4|mov|m4v)$/i;
const POST_YAML_NAMES = ["post.yaml", "post.yml"];
const IMPORTED_DIR_NAME = ".imported";

const PostFrontmatter = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date deve ser YYYY-MM-DD"),
    title: z.string().min(1, "title é obrigatório"),
    type: z.enum(["single", "carousel", "reel", "story"]).optional(),
    auto_publish: z.boolean().optional(),
    account_id: z.string().optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "time deve ser HH:MM")
      .optional(),
    caption_ig: z.string().optional(),
    caption_li: z.string().optional(),
    images: z.array(z.string()).optional(),
    videos: z.array(z.string()).optional(),
  })
  .strict();

export type PostFrontmatter = z.infer<typeof PostFrontmatter>;

export type StagingEntry =
  | {
      kind: "ok";
      folder: string;
      relPath: string;
      frontmatter: PostFrontmatter;
      mediaFiles: string[];
    }
  | {
      kind: "error";
      folder: string;
      relPath: string;
      message: string;
    };

export async function stagingRoot(): Promise<string> {
  const config = await loadConfig();
  return path.resolve(process.cwd(), config.staging_dir);
}

export async function scanStaging(): Promise<StagingEntry[]> {
  const root = await stagingRoot();
  let dirents;
  try {
    dirents = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const entries = await Promise.all(
    dirents
      .filter((d) => d.isDirectory() && d.name !== IMPORTED_DIR_NAME && !d.name.startsWith("."))
      .map((d) => readEntry(path.join(root, d.name), d.name))
  );
  return entries.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

async function readEntry(folder: string, relPath: string): Promise<StagingEntry> {
  const yamlPath = await findYamlPath(folder);
  if (!yamlPath) {
    return { kind: "error", folder, relPath, message: "post.yaml não encontrado" };
  }
  let parsed: unknown;
  try {
    const raw = await fs.readFile(yamlPath, "utf8");
    parsed = YAML.parse(raw);
  } catch (e) {
    return {
      kind: "error",
      folder,
      relPath,
      message: `YAML inválido: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const result = PostFrontmatter.safeParse(parsed);
  if (!result.success) {
    return {
      kind: "error",
      folder,
      relPath,
      message: result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
    };
  }
  const frontmatter = result.data;
  const mediaFiles = await resolveMedia(folder, frontmatter);
  if (mediaFiles.length === 0) {
    return { kind: "error", folder, relPath, message: "nenhuma mídia encontrada" };
  }
  return { kind: "ok", folder, relPath, frontmatter, mediaFiles };
}

async function findYamlPath(folder: string): Promise<string | null> {
  for (const name of POST_YAML_NAMES) {
    const p = path.join(folder, name);
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  return null;
}

async function resolveMedia(folder: string, fm: PostFrontmatter): Promise<string[]> {
  if (fm.images && fm.images.length > 0) return fm.images;
  if (fm.videos && fm.videos.length > 0) return fm.videos;
  const wantVideo = fm.type === "reel" || fm.type === "story";
  const entries = await fs.readdir(folder);
  const re = wantVideo ? VIDEO_RE : IMAGE_RE;
  return entries.filter((f) => re.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function detectType(fm: PostFrontmatter, mediaCount: number): PostType {
  if (fm.type) return fm.type;
  return mediaCount >= 2 ? "carousel" : "single";
}

export type ImportResult = {
  relPath: string;
  slug?: string;
  error?: string;
};

export async function importEntry(entry: StagingEntry): Promise<ImportResult> {
  if (entry.kind === "error") {
    return { relPath: entry.relPath, error: entry.message };
  }
  try {
    const buffers = await Promise.all(
      entry.mediaFiles.map(async (name) => ({
        name,
        buffer: await fs.readFile(path.join(entry.folder, name)),
      }))
    );
    const fm = entry.frontmatter;
    const slug = await createPost({
      date: fm.date,
      title: fm.title,
      images: buffers,
      type: detectType(fm, buffers.length),
      auto_publish: fm.auto_publish,
      account_id: fm.account_id,
    });
    if (fm.caption_ig) await writeCaption(slug, "ig", fm.caption_ig);
    if (fm.caption_li) await writeCaption(slug, "li", fm.caption_li);
    if (fm.time) await applyScheduledTime(slug, fm.date, fm.time);
    await moveToImported(entry.folder, entry.relPath);
    return { relPath: entry.relPath, slug };
  } catch (e) {
    return {
      relPath: entry.relPath,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function applyScheduledTime(slug: string, date: string, time: string): Promise<void> {
  const { POSTS_DIR } = await import("./posts");
  const metaPath = path.join(POSTS_DIR, slug, "meta.json");
  const raw = await fs.readFile(metaPath, "utf8");
  const meta = JSON.parse(raw);
  meta.scheduled = `${date}T${time}`;
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
}

async function moveToImported(folder: string, relPath: string): Promise<void> {
  const root = await stagingRoot();
  const archive = path.join(root, IMPORTED_DIR_NAME);
  await fs.mkdir(archive, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const target = path.join(archive, `${stamp}__${relPath}`);
  await fs.rename(folder, target);
}

export async function importAll(): Promise<ImportResult[]> {
  const entries = await scanStaging();
  const results: ImportResult[] = [];
  for (const entry of entries) {
    results.push(await importEntry(entry));
  }
  return results;
}
