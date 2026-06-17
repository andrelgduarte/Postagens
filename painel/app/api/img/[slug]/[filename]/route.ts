import { promises as fs } from "node:fs";
import path from "node:path";
import { POSTS_DIR } from "@/lib/posts";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; filename: string }> }
) {
  const { slug, filename } = await ctx.params;

  if (slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    return new Response("Bad request", { status: 400 });
  }
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return new Response("Bad request", { status: 400 });
  }

  const ext = path.extname(filename).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return new Response("Unsupported", { status: 415 });

  const filePath = path.join(POSTS_DIR, slug, filename);
  try {
    const data = await fs.readFile(filePath);
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": mime,
        "cache-control": "private, max-age=60",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
