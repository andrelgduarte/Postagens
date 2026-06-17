import { isNotNull } from "drizzle-orm";
import { db } from "./db/client";
import { media as mediaTable } from "./db/schema";
import { blobEnabled, deleteMediaBlob, listAllMediaBlobs } from "./blob";
import { logEvent } from "./publish-log";

export type CleanupResult = {
  blobsTotal: number;
  knownInDb: number;
  orphans: number;
  deleted: number;
  errors: number;
};

export async function cleanupOrphanBlobs(opts: { dryRun?: boolean } = {}): Promise<CleanupResult> {
  if (!blobEnabled()) {
    throw new Error("BLOB_READ_WRITE_TOKEN ausente");
  }

  const [allBlobs, dbBlobs] = await Promise.all([
    listAllMediaBlobs(),
    db.select({ blobUrl: mediaTable.blobUrl }).from(mediaTable).where(isNotNull(mediaTable.blobUrl)),
  ]);

  const known = new Set(dbBlobs.map((r) => r.blobUrl as string));
  const orphans = allBlobs.filter((url) => !known.has(url));

  const result: CleanupResult = {
    blobsTotal: allBlobs.length,
    knownInDb: known.size,
    orphans: orphans.length,
    deleted: 0,
    errors: 0,
  };

  if (opts.dryRun || orphans.length === 0) {
    await logEvent({
      event: "publish_ok",
      message: `cleanup ${opts.dryRun ? "(dry-run) " : ""}encontrou ${orphans.length} órfão(s) de ${allBlobs.length} blob(s)`,
    });
    return result;
  }

  for (const url of orphans) {
    try {
      await deleteMediaBlob(url);
      result.deleted += 1;
    } catch {
      result.errors += 1;
    }
  }

  await logEvent({
    event: "publish_ok",
    message: `cleanup removeu ${result.deleted} órfão(s)${result.errors ? `, ${result.errors} erro(s)` : ""}`,
  });
  return result;
}
