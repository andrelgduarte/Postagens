import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { db } from "./db/client";
import {
  captions as captionsTable,
  media as mediaTable,
  posts as postsTable,
} from "./db/schema";
import { getAccountUuid, loadConfig } from "./config";
import {
  nextAvailableSlug,
  slugify,
  type PostType,
} from "./posts";
import { currentUserId } from "./auth";
import { blobEnabled, uploadMediaBlob } from "./blob";

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

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

function classify(filename: string): "image" | "video" | null {
  if (IMAGE_RE.test(filename)) return "image";
  if (VIDEO_RE.test(filename)) return "video";
  return null;
}

export function parseFrontmatter(raw: string): PostFrontmatter {
  return PostFrontmatter.parse(YAML.parse(raw));
}

export function validateFrontmatter(value: unknown): PostFrontmatter {
  return PostFrontmatter.parse(value);
}

function detectType(fm: PostFrontmatter, mediaCount: number, hasVideo: boolean): PostType {
  if (fm.type) return fm.type;
  if (hasVideo) return "reel";
  return mediaCount >= 2 ? "carousel" : "single";
}

function parseScheduled(date: string, time?: string): Date | null {
  if (!time) {
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ImportPayload = {
  frontmatter: PostFrontmatter;
  media: {
    filename: string;
    kind: "image" | "video";
    url: string;
    sizeBytes?: number;
    contentType?: string;
  }[];
  userId?: string;
};

// Pure DB import — used by the browser uploader and the local CLI.
export async function importFromPayload(opts: ImportPayload): Promise<{ slug: string }> {
  const uid = opts.userId ?? (await currentUserId());
  const fm = opts.frontmatter;
  if (opts.media.length === 0) throw new Error("Sem mídia");

  const slugBase = `${fm.date}-${slugify(fm.title) || "post"}`;
  const slug = await nextAvailableSlug(slugBase, uid);
  const hasVideo = opts.media.some((m) => m.kind === "video");
  const type = detectType(fm, opts.media.length, hasVideo);
  const accountUuid = fm.account_id ? await getAccountUuid(fm.account_id, uid) : null;
  const scheduled = parseScheduled(fm.date, fm.time);

  const [inserted] = await db
    .insert(postsTable)
    .values({
      userId: uid,
      slug,
      date: fm.date,
      title: fm.title,
      type,
      autoPublish: fm.auto_publish ?? false,
      accountId: accountUuid,
      scheduled,
    })
    .returning({ id: postsTable.id });

  await db.insert(captionsTable).values([
    { postId: inserted.id, network: "ig", content: fm.caption_ig ?? "" },
    { postId: inserted.id, network: "li", content: fm.caption_li ?? "" },
  ]);

  await db.insert(mediaTable).values(
    opts.media.map((m, idx) => ({
      postId: inserted.id,
      kind: m.kind,
      filename: m.filename,
      sortOrder: idx,
      blobUrl: m.url,
      sizeBytes: m.sizeBytes ?? null,
      contentType: m.contentType ?? CONTENT_TYPE[path.extname(m.filename).toLowerCase()] ?? null,
    }))
  );

  return { slug };
}

// ----- Local FS staging scanner (CLI workflow) -----

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
    const fm = entry.frontmatter;
    const useBlob = blobEnabled();
    const userId = process.env.WORKER_USER_ID || process.env.DEV_USER_ID || "default-user";

    const media: ImportPayload["media"] = [];
    for (const filename of entry.mediaFiles) {
      const kind = classify(filename);
      if (!kind) continue;
      const buffer = await fs.readFile(path.join(entry.folder, filename));
      const ext = path.extname(filename).toLowerCase();
      const contentType = CONTENT_TYPE[ext];

      let url: string;
      if (useBlob) {
        const slugBase = `${fm.date}-${slugify(fm.title) || "post"}`;
        const result = await uploadMediaBlob({
          userId,
          slug: slugBase,
          filename,
          buffer,
          contentType,
        });
        url = result.url;
      } else {
        throw new Error("Blob não configurado e a CLI agora sempre sobe pro Blob");
      }
      media.push({ filename, kind, url, sizeBytes: buffer.length, contentType });
    }

    const { slug } = await importFromPayload({
      frontmatter: fm,
      media,
      userId,
    });
    await moveToImported(entry.folder, entry.relPath);
    return { relPath: entry.relPath, slug };
  } catch (e) {
    return {
      relPath: entry.relPath,
      error: e instanceof Error ? e.message : String(e),
    };
  }
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
