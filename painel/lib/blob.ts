import { put, del } from "@vercel/blob";

export function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function blobPath(userId: string, slug: string, filename: string): string {
  return `media/${userId}/${slug}/${filename}`;
}

export async function uploadMediaBlob(opts: {
  userId: string;
  slug: string;
  filename: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ url: string }> {
  const blob = await put(blobPath(opts.userId, opts.slug, opts.filename), opts.buffer, {
    access: "public",
    contentType: opts.contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { url: blob.url };
}

export async function deleteMediaBlob(url: string): Promise<void> {
  try {
    await del(url);
  } catch {
    // best-effort: blob might already be gone, ignore
  }
}
