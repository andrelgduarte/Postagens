import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { threadsAccounts } from "./db/schema";
import { getThreadsAccount } from "./threads-accounts";
import {
  createCarouselContainer,
  createImageContainer,
  createTextContainer,
  createVideoContainer,
  getContainerStatus,
  publishContainer,
  refreshLongLivedToken,
} from "./threads-api";
import type { PostDetail } from "./posts";
import { cleanupTempMedia, resolveMediaUrls } from "./media-resolve";

const REFRESH_BEFORE_MS = 24 * 60 * 60_000;
const MAX_POLL_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 5_000;

export type PublishResult =
  | { ok: true; threadId: string }
  | { ok: false; error: string };

async function ensureFreshToken(
  accountId: string,
  accessToken: string,
  expiresAt: Date | null
): Promise<string> {
  if (!expiresAt) return accessToken;
  if (expiresAt.getTime() - Date.now() > REFRESH_BEFORE_MS) return accessToken;
  const refreshed = await refreshLongLivedToken({ accessToken });
  const now = Date.now();
  await db
    .update(threadsAccounts)
    .set({
      accessToken: refreshed.access_token,
      tokenExpiresAt: new Date(now + refreshed.expires_in * 1000),
      updatedAt: new Date(),
    })
    .where(eq(threadsAccounts.id, accountId));
  return refreshed.access_token;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForContainer(token: string, containerId: string): Promise<void> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const s = await getContainerStatus({ token, containerId });
    if (s.status === "FINISHED" || s.status === "PUBLISHED") return;
    if (s.status === "ERROR" || s.status === "EXPIRED") {
      throw new Error(`container ${s.status}: ${s.error_message ?? "?"}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("container ainda IN_PROGRESS após 60s — Threads não terminou de baixar a mídia");
}

export async function publishThreadsPost(opts: {
  userId: string;
  post: PostDetail;
}): Promise<PublishResult> {
  const account = await getThreadsAccount(opts.userId);
  if (!account) {
    return { ok: false, error: "Nenhuma conta Threads conectada — vá em /settings → Conectar Threads" };
  }

  let token: string;
  try {
    token = await ensureFreshToken(account.id, account.accessToken, account.tokenExpiresAt);
  } catch (e) {
    return { ok: false, error: `refresh token: ${e instanceof Error ? e.message : String(e)}` };
  }

  const hasVideo = opts.post.videos.length > 0;
  const filenames = hasVideo ? [opts.post.videos[0]] : opts.post.images;
  const text = opts.post.captionTh.trim();

  if (filenames.length === 0 && !text) {
    return { ok: false, error: "Post sem mídia nem texto — Threads exige pelo menos um" };
  }

  let resolved: { url: string; temp: boolean }[] = [];
  try {
    if (filenames.length > 0) {
      resolved = await resolveMediaUrls(opts.post.slug, filenames, opts.post.userId);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  try {
    let containerId: string;
    if (filenames.length === 0) {
      containerId = await createTextContainer({
        token,
        userId: account.threadsUserId,
        text,
      });
    } else if (hasVideo) {
      containerId = await createVideoContainer({
        token,
        userId: account.threadsUserId,
        videoUrl: resolved[0].url,
        text: text || undefined,
      });
    } else if (resolved.length === 1) {
      containerId = await createImageContainer({
        token,
        userId: account.threadsUserId,
        imageUrl: resolved[0].url,
        text: text || undefined,
      });
    } else {
      const childIds: string[] = [];
      for (const m of resolved) {
        const id = await createImageContainer({
          token,
          userId: account.threadsUserId,
          imageUrl: m.url,
          isCarouselItem: true,
        });
        childIds.push(id);
      }
      for (const id of childIds) await waitForContainer(token, id);
      containerId = await createCarouselContainer({
        token,
        userId: account.threadsUserId,
        childrenIds: childIds,
        text: text || undefined,
      });
    }

    await waitForContainer(token, containerId);
    const threadId = await publishContainer({
      token,
      userId: account.threadsUserId,
      containerId,
    });
    return { ok: true, threadId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await cleanupTempMedia(resolved);
  }
}
