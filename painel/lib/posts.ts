import { promises as fs } from "node:fs";
import path from "node:path";

export const POSTS_DIR = path.resolve(process.cwd(), "..", "posts");

export type NetworkStatus = "queued" | "posted" | "skipped";

export type PostMeta = {
  scheduled?: string;
  status_ig: NetworkStatus;
  status_li: NetworkStatus;
  tags?: string[];
};

export type Post = {
  slug: string;
  date: string;
  title: string;
  images: string[];
  meta: PostMeta;
};

export type PostDetail = Post & {
  captionIg: string;
  captionLi: string;
};

const DEFAULT_META: PostMeta = {
  status_ig: "queued",
  status_li: "queued",
};

const SLUG_REGEX = /^(\d{4}-\d{2}-\d{2})(?:-(.+))?$/;

async function ensurePostsDir() {
  await fs.mkdir(POSTS_DIR, { recursive: true });
}

async function readMeta(slug: string): Promise<PostMeta> {
  const file = path.join(POSTS_DIR, slug, "meta.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    return { ...DEFAULT_META, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_META };
  }
}

async function readCaption(slug: string, network: "ig" | "li"): Promise<string> {
  const file = path.join(POSTS_DIR, slug, `caption_${network}.md`);
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function listImages(slug: string): Promise<string[]> {
  const dir = path.join(POSTS_DIR, slug);
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

function parseSlug(slug: string): { date: string; title: string } | null {
  const match = SLUG_REGEX.exec(slug);
  if (!match) return null;
  return {
    date: match[1],
    title: match[2]?.replace(/-/g, " ") ?? slug,
  };
}

export async function listPosts(): Promise<Post[]> {
  await ensurePostsDir();
  const entries = await fs.readdir(POSTS_DIR, { withFileTypes: true });
  const posts = await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (e) => {
        const parsed = parseSlug(e.name);
        if (!parsed) return null;
        const [images, meta] = await Promise.all([
          listImages(e.name),
          readMeta(e.name),
        ]);
        return {
          slug: e.name,
          date: parsed.date,
          title: parsed.title,
          images,
          meta,
        } satisfies Post;
      })
  );
  return posts
    .filter((p): p is Post => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getPost(slug: string): Promise<PostDetail | null> {
  const parsed = parseSlug(slug);
  if (!parsed) return null;
  const dir = path.join(POSTS_DIR, slug);
  try {
    await fs.access(dir);
  } catch {
    return null;
  }
  const [images, meta, captionIg, captionLi] = await Promise.all([
    listImages(slug),
    readMeta(slug),
    readCaption(slug, "ig"),
    readCaption(slug, "li"),
  ]);
  return {
    slug,
    date: parsed.date,
    title: parsed.title,
    images,
    meta,
    captionIg,
    captionLi,
  };
}

export async function writeMeta(slug: string, meta: PostMeta): Promise<void> {
  const file = path.join(POSTS_DIR, slug, "meta.json");
  await fs.writeFile(file, JSON.stringify(meta, null, 2) + "\n", "utf8");
}

export async function writeCaption(
  slug: string,
  network: "ig" | "li",
  content: string
): Promise<void> {
  const file = path.join(POSTS_DIR, slug, `caption_${network}.md`);
  await fs.writeFile(file, content, "utf8");
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createPost(opts: {
  date: string;
  title: string;
  images: { name: string; buffer: Buffer }[];
}): Promise<string> {
  await ensurePostsDir();
  const slugBase = `${opts.date}-${slugify(opts.title) || "post"}`;
  let slug = slugBase;
  let n = 1;
  while (true) {
    try {
      await fs.access(path.join(POSTS_DIR, slug));
      n += 1;
      slug = `${slugBase}-${n}`;
    } catch {
      break;
    }
  }
  const dir = path.join(POSTS_DIR, slug);
  await fs.mkdir(dir, { recursive: true });

  const sorted = [...opts.images].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );
  await Promise.all(
    sorted.map((img, idx) => {
      const ext = path.extname(img.name).toLowerCase() || ".jpg";
      const filename = `${String(idx + 1).padStart(2, "0")}${ext}`;
      return fs.writeFile(path.join(dir, filename), img.buffer);
    })
  );

  await Promise.all([
    writeCaption(slug, "ig", ""),
    writeCaption(slug, "li", ""),
    writeMeta(slug, { ...DEFAULT_META }),
  ]);
  return slug;
}

export function imageUrl(slug: string, filename: string): string {
  return `/api/img/${encodeURIComponent(slug)}/${encodeURIComponent(filename)}`;
}
