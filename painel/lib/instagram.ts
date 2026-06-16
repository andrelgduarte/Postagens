import { promises as fs } from "node:fs";
import path from "node:path";
import { put, del } from "@vercel/blob";
import { POSTS_DIR } from "./posts";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v22.0";
const GRAPH_BASE = "https://graph.facebook.com";

function env() {
  const token = process.env.META_ACCESS_TOKEN;
  const igUserId = process.env.META_IG_USER_ID;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado em .env.local");
  if (!igUserId) throw new Error("META_IG_USER_ID não configurado em .env.local");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN não configurado em .env.local");
  }
  return { token, igUserId };
}

type GraphResponse = { id?: string; status_code?: string; error?: { message?: string } };

async function graphPost(endpoint: string, params: Record<string, string>): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH_BASE}/${GRAPH_VERSION}/${endpoint}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const data = (await res.json()) as GraphResponse;
  if (!res.ok || data.error || !data.id) {
    throw new Error(data.error?.message ?? `Graph ${res.status} em ${endpoint}`);
  }
  return { id: data.id };
}

async function waitForContainer(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 15; i++) {
    const res = await fetch(
      `${GRAPH_BASE}/${GRAPH_VERSION}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`
    );
    const data = (await res.json()) as GraphResponse;
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`Container ${containerId} retornou ${data.status_code}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timeout esperando container ${containerId}`);
}

async function uploadToBlob(slug: string, filename: string): Promise<{ url: string }> {
  const filePath = path.join(POSTS_DIR, slug, filename);
  const data = await fs.readFile(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const pathname = `ig/${slug}/${Date.now()}-${filename}`;
  const blob = await put(pathname, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return { url: blob.url };
}

export async function publishInstagram(opts: {
  slug: string;
  images: string[];
  caption: string;
}): Promise<{ postId: string }> {
  const { token, igUserId } = env();
  if (opts.images.length === 0) throw new Error("Sem imagens");

  const blobs = await Promise.all(opts.images.map((img) => uploadToBlob(opts.slug, img)));

  try {
    let creationId: string;

    if (blobs.length === 1) {
      const container = await graphPost(`${igUserId}/media`, {
        image_url: blobs[0].url,
        caption: opts.caption,
        access_token: token,
      });
      await waitForContainer(container.id, token);
      creationId = container.id;
    } else {
      const children = await Promise.all(
        blobs.map((b) =>
          graphPost(`${igUserId}/media`, {
            image_url: b.url,
            is_carousel_item: "true",
            access_token: token,
          })
        )
      );
      await Promise.all(children.map((c) => waitForContainer(c.id, token)));
      const carousel = await graphPost(`${igUserId}/media`, {
        media_type: "CAROUSEL",
        children: children.map((c) => c.id).join(","),
        caption: opts.caption,
        access_token: token,
      });
      await waitForContainer(carousel.id, token);
      creationId = carousel.id;
    }

    const published = await graphPost(`${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    });

    return { postId: published.id };
  } finally {
    await Promise.allSettled(blobs.map((b) => del(b.url)));
  }
}
