import { promises as fs } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { media as mediaTable, posts as postsTable } from "./db/schema";
import { POSTS_DIR, type PostType } from "./posts";
import { getAccount } from "./config";
import { blobEnabled, deleteMediaBlob, uploadMediaBlob } from "./blob";

const GRAPH_BASE = "https://graph.facebook.com";

type GraphResponse = { id?: string; status_code?: string; error?: { message?: string } };

async function graphPost(
  version: string,
  endpoint: string,
  params: Record<string, string>
): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH_BASE}/${version}/${endpoint}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const data = (await res.json()) as GraphResponse;
  if (!res.ok || data.error || !data.id) {
    throw new Error(data.error?.message ?? `Graph ${res.status} em ${endpoint}`);
  }
  return { id: data.id };
}

async function waitForContainer(
  version: string,
  containerId: string,
  token: string,
  opts: { attempts: number; delayMs: number }
): Promise<void> {
  for (let i = 0; i < opts.attempts; i++) {
    const res = await fetch(
      `${GRAPH_BASE}/${version}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`
    );
    const data = (await res.json()) as GraphResponse;
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`Container ${containerId} retornou ${data.status_code}`);
    }
    await new Promise((r) => setTimeout(r, opts.delayMs));
  }
  throw new Error(`Timeout esperando container ${containerId}`);
}

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

type ResolvedMedia = { url: string; temp: boolean };

async function resolveMediaUrls(
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

async function cleanupTemp(resolved: ResolvedMedia[]): Promise<void> {
  await Promise.allSettled(
    resolved.filter((r) => r.temp).map((r) => deleteMediaBlob(r.url))
  );
}

const IMAGE_POLL = { attempts: 15, delayMs: 2000 };
const VIDEO_POLL = { attempts: 60, delayMs: 10000 };

export async function publishInstagram(opts: {
  slug: string;
  type: PostType;
  images: string[];
  videos: string[];
  caption: string;
  accountId?: string;
  userId?: string;
}): Promise<{ postId: string; accountName: string }> {
  const account = await getAccount(opts.accountId, opts.userId);
  const userId = opts.userId ?? "default-user";
  const token = account.token;
  const igUserId = account.ig_user_id;
  const version = account.graph_version ?? "v22.0";

  if (opts.type === "reel") {
    return publishReel(opts, userId, igUserId, token, version, account.name);
  }
  if (opts.type === "story") {
    return publishStory(opts, userId, igUserId, token, version, account.name);
  }
  return publishPhoto(opts, userId, igUserId, token, version, account.name);
}

async function publishPhoto(
  opts: { slug: string; images: string[]; caption: string },
  userId: string,
  igUserId: string,
  token: string,
  version: string,
  accountName: string
): Promise<{ postId: string; accountName: string }> {
  if (opts.images.length === 0) throw new Error("Sem imagens");

  const resolved = await resolveMediaUrls(opts.slug, opts.images, userId);
  try {
    let creationId: string;
    if (resolved.length === 1) {
      const container = await graphPost(version, `${igUserId}/media`, {
        image_url: resolved[0].url,
        caption: opts.caption,
        access_token: token,
      });
      await waitForContainer(version, container.id, token, IMAGE_POLL);
      creationId = container.id;
    } else {
      const children = await Promise.all(
        resolved.map((r) =>
          graphPost(version, `${igUserId}/media`, {
            image_url: r.url,
            is_carousel_item: "true",
            access_token: token,
          })
        )
      );
      await Promise.all(
        children.map((c) => waitForContainer(version, c.id, token, IMAGE_POLL))
      );
      const carousel = await graphPost(version, `${igUserId}/media`, {
        media_type: "CAROUSEL",
        children: children.map((c) => c.id).join(","),
        caption: opts.caption,
        access_token: token,
      });
      await waitForContainer(version, carousel.id, token, IMAGE_POLL);
      creationId = carousel.id;
    }

    const published = await graphPost(version, `${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    });
    return { postId: published.id, accountName };
  } finally {
    await cleanupTemp(resolved);
  }
}

async function publishReel(
  opts: { slug: string; videos: string[]; caption: string },
  userId: string,
  igUserId: string,
  token: string,
  version: string,
  accountName: string
): Promise<{ postId: string; accountName: string }> {
  if (opts.videos.length === 0) throw new Error("Reel exige 1 vídeo (.mp4/.mov)");
  const resolved = await resolveMediaUrls(opts.slug, [opts.videos[0]], userId);
  try {
    const container = await graphPost(version, `${igUserId}/media`, {
      media_type: "REELS",
      video_url: resolved[0].url,
      caption: opts.caption,
      access_token: token,
    });
    await waitForContainer(version, container.id, token, VIDEO_POLL);
    const published = await graphPost(version, `${igUserId}/media_publish`, {
      creation_id: container.id,
      access_token: token,
    });
    return { postId: published.id, accountName };
  } finally {
    await cleanupTemp(resolved);
  }
}

async function publishStory(
  opts: { slug: string; images: string[]; videos: string[] },
  userId: string,
  igUserId: string,
  token: string,
  version: string,
  accountName: string
): Promise<{ postId: string; accountName: string }> {
  const hasVideo = opts.videos.length > 0;
  const hasImage = opts.images.length > 0;
  if (!hasVideo && !hasImage) throw new Error("Story exige 1 mídia");

  const file = hasVideo ? opts.videos[0] : opts.images[0];
  const resolved = await resolveMediaUrls(opts.slug, [file], userId);
  try {
    const container = await graphPost(version, `${igUserId}/media`, {
      media_type: "STORIES",
      ...(hasVideo ? { video_url: resolved[0].url } : { image_url: resolved[0].url }),
      access_token: token,
    });
    await waitForContainer(
      version,
      container.id,
      token,
      hasVideo ? VIDEO_POLL : IMAGE_POLL
    );
    const published = await graphPost(version, `${igUserId}/media_publish`, {
      creation_id: container.id,
      access_token: token,
    });
    return { postId: published.id, accountName };
  } finally {
    await cleanupTemp(resolved);
  }
}
