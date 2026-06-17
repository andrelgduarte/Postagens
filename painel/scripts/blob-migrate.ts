import { promises as fs } from "node:fs";
import path from "node:path";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "../lib/db/client";
import { media as mediaTable, posts as postsTable } from "../lib/db/schema";
import { blobEnabled, uploadMediaBlob } from "../lib/blob";
import { POSTS_DIR } from "../lib/posts";

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

async function main() {
  if (!blobEnabled()) {
    console.error("BLOB_READ_WRITE_TOKEN ausente em .env.local — abortando");
    process.exit(1);
  }

  const rows = await db
    .select({
      id: mediaTable.id,
      filename: mediaTable.filename,
      localPath: mediaTable.localPath,
      contentType: mediaTable.contentType,
      slug: postsTable.slug,
      userId: postsTable.userId,
    })
    .from(mediaTable)
    .innerJoin(postsTable, eq(mediaTable.postId, postsTable.id))
    .where(and(isNotNull(mediaTable.localPath), isNull(mediaTable.blobUrl)));

  if (rows.length === 0) {
    console.log("Nada para migrar.");
    return;
  }

  console.log(`Migrando ${rows.length} mídia(s) para o Vercel Blob…`);
  let ok = 0;
  let fail = 0;

  for (const r of rows) {
    const fullPath = path.join(POSTS_DIR, r.localPath!);
    try {
      const buffer = await fs.readFile(fullPath);
      const ext = path.extname(r.filename).toLowerCase();
      const { url } = await uploadMediaBlob({
        userId: r.userId,
        slug: r.slug,
        filename: r.filename,
        buffer,
        contentType: r.contentType ?? CONTENT_TYPE[ext],
      });
      await db
        .update(mediaTable)
        .set({ blobUrl: url })
        .where(eq(mediaTable.id, r.id));
      console.log(`  ✓ ${r.slug}/${r.filename}`);
      ok += 1;
    } catch (e) {
      console.log(
        `  ✗ ${r.slug}/${r.filename}: ${e instanceof Error ? e.message : String(e)}`
      );
      fail += 1;
    }
  }

  console.log(`\nResumo: ${ok} ok, ${fail} erro(s).`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
