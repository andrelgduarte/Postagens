import type { PostDetail } from "./posts";
import { imageUrl } from "./posts";

export type LinkedInPayload = {
  slug: string;
  title: string;
  caption: string;
  scheduled?: string;
  type?: string;
  media: { kind: "image" | "video"; url: string; filename: string }[];
};

function publicMediaUrl(baseUrl: string | undefined, slug: string, filename: string): string {
  if (!baseUrl) return imageUrl(slug, filename);
  return `${baseUrl.replace(/\/$/, "")}${imageUrl(slug, filename)}`;
}

export function buildPayload(post: PostDetail, baseUrl?: string): LinkedInPayload {
  const media: LinkedInPayload["media"] = [
    ...post.images.map((filename) => ({
      kind: "image" as const,
      filename,
      url: publicMediaUrl(baseUrl, post.slug, filename),
    })),
    ...post.videos.map((filename) => ({
      kind: "video" as const,
      filename,
      url: publicMediaUrl(baseUrl, post.slug, filename),
    })),
  ];

  return {
    slug: post.slug,
    title: post.title,
    caption: post.captionLi,
    scheduled: post.meta.scheduled,
    type: post.meta.type,
    media,
  };
}

export type WebhookResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string };

export async function publishLinkedInWebhook(opts: {
  webhookUrl: string;
  payload: LinkedInPayload;
}): Promise<WebhookResult> {
  try {
    const res = await fetch(opts.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts.payload),
    });
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: res.status };
    }
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: `webhook ${res.status}: ${text.slice(0, 200)}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
