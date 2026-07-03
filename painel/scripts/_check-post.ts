import { db } from "../lib/db/client";
import { media, posts } from "../lib/db/schema";
import { and, eq } from "drizzle-orm";

async function main() {
  const slug = "2026-06-30-escreva-antes-de-falar";
  const p = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  console.log("post:", p[0] ? { id: p[0].id, status_li: p[0].statusLi, type: p[0].type } : "not found");
  if (p[0]) {
    const m = await db.select().from(media).where(eq(media.postId, p[0].id));
    for (const r of m) {
      console.log("media:", { filename: r.filename, kind: r.kind, sizeBytes: r.sizeBytes, contentType: r.contentType, blobUrl: r.blobUrl?.slice(0, 60) + "..." });
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
