import { promises as fs } from "node:fs";
import path from "node:path";
import { put, del } from "@vercel/blob";
import { POSTS_DIR, type PostType } from "./posts";
import { getAccount } from "./config";

const GRAPH_BASE = "https://graph.facebook.com";

function requireBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN não configurado em .env.local");
  }
}

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

async function uploadMediaToBlob(
  slug: string,
  filename: string,
  kind: "image" | "video"
): Promise<{ url: string }> {
  const filePath = path.join(POSTS_DIR, slug, filename);
  const data = await fs.readFile(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = CONTENT_TYPE[ext] ?? (kind === "video" ? "video/mp4" : "image/jpeg");
  const folder = kind === "video" ? "ig-video" : "ig";
  const pathname = `${folder}/${slug}/${Date.now()}-${filename}`;
  const blob = await put(pathname, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return { url: blob.url };
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
}): Promise<{ postId: string; accountName: string }> {
  requireBlobToken();

  const account = await getAccount(opts.accountId);
  const token = account.token;
  const igUserId = account.ig_user_id;
  const version = account.graph_version ?? "v22.0";

  if (opts.type === "reel") return publishReel(opts, igUserId, token, version, account.name);
  if (opts.type === "story") return publishStory(opts, igUserId, token, version, account.name);
  return publishPhoto(opts, igUserId, token, version, account.name);
}

async function publishPhoto(
  opts: { slug: string; images: string[]; caption: string },
  igUserId: string,
  token: string,
  version: string,
  accountName: string
): Promise<{ postId: string; accountName: string }> {
  if (opts.images.length === 0) throw new Error("Sem imagens");

  const blobs = await Promise.all(
    opts.images.map((img) => uploadMediaToBlob(opts.slug, img, "image"))
  );

  try {
    let creationId: string;
    if (blobs.length === 1) {
      const container = await graphPost(version, `${igUserId}/media`, {
        image_url: blobs[0].url,
        caption: opts.caption,
        access_token: token,
      });
      await waitForContainer(version, container.id, token, IMAGE_POLL);
      creationId = container.id;
    } else {
      const children = await Promise.all(
        blobs.map((b) =>
          graphPost(version, `${igUserId}/media`, {
            image_url: b.url,
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
    await Promise.allSettled(blobs.map((b) => del(b.url)));
  }
}

async function publishReel(
  opts: { slug: string; videos: string[]; caption: string },
  igUserId: string,
  token: string,
  version: string,
  accountName: string
): Promise<{ postId: string; accountName: string }> {
  if (opts.videos.length === 0) throw new Error("Reel exige 1 vídeo (.mp4/.mov)");
  const blob = await uploadMediaToBlob(opts.slug, opts.videos[0], "video");
  try {
    const container = await graphPost(version, `${igUserId}/media`, {
      media_type: "REELS",
      video_url: blob.url,
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
    await Promise.allSettled([del(blob.url)]);
  }
}

async function publishStory(
  opts: { slug: string; images: string[]; videos: string[] },
  igUserId: string,
  token: string,
  version: string,
  accountName: string
): Promise<{ postId: string; accountName: string }> {
  const hasVideo = opts.videos.length > 0;
  const hasImage = opts.images.length > 0;
  if (!hasVideo && !hasImage) throw new Error("Story exige 1 mídia");

  const blob = hasVideo
    ? await uploadMediaToBlob(opts.slug, opts.videos[0], "video")
    : await uploadMediaToBlob(opts.slug, opts.images[0], "image");

  try {
    const container = await graphPost(version, `${igUserId}/media`, {
      media_type: "STORIES",
      ...(hasVideo ? { video_url: blob.url } : { image_url: blob.url }),
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
    await Promise.allSettled([del(blob.url)]);
  }
}
