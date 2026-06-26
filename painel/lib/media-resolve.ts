import { promises as fs } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { media as mediaTable, posts as postsTable } from "./db/schema";
import { POSTS_DIR } from "./posts";
import { blobEnabled, deleteMediaBlob, uploadMediaBlob } from "./blob";

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

export type ResolvedMedia = { url: string; temp: boolean };

export async function resolveMediaUrls(
  slug: string,
  filenames: string[],
  userId: string
): Promise<ResolvedMedia[]> {
  if (filenames.length === 0) return [];
  const rows = await db
    .select({
      filename: mediaTable.filename,
      blobUrl: mediaTable.blobUrl,
    })
    .from(mediaTable)
    .innerJoin(postsTable, eq(mediaTable.postId, postsTable.id))
    .where(and(eq(postsTable.slug, slug), eq(postsTable.userId, userId)));
  const byFilename = new Map(rows.map((r) => [r.filename, r.blobUrl]));

  const resolved: ResolvedMedia[] = [];
  for (const filename of filenames) {
    const blobUrl = byFilename.get(filename);
    if (blobUrl) {
      resolved.push({ url: blobUrl, temp: false });
      continue;
    }
    if (!blobEnabled()) {
      throw new Error(
        `Mídia ${slug}/${filename} sem blob_url e BLOB_READ_WRITE_TOKEN ausente. Configure o Blob ou rode 'npm run blob:migrate'.`
      );
    }
    const filePath = path.join(POSTS_DIR, slug, filename);
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = CONTENT_TYPE[ext];
    const tempName = `__tmp/${Date.now()}-${filename}`;
    const { url } = await uploadMediaBlob({
      userId,
      slug,
      filename: tempName,
      buffer,
      contentType,
    });
    resolved.push({ url, temp: true });
  }
  return resolved;
}

export async function cleanupTempMedia(resolved: ResolvedMedia[]): Promise<void> {
  await Promise.allSettled(
    resolved.filter((r) => r.temp).map((r) => deleteMediaBlob(r.url))
  );
}
