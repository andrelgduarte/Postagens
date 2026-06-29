import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { tiktokAccounts } from "./db/schema";
import { getTiktokAccount } from "./tiktok-accounts";
import {
  initInboxPhotoPost,
  initInboxVideoPost,
  refreshAccessToken,
} from "./tiktok-api";
import type { PostDetail } from "./posts";
import { cleanupTempMedia, resolveMediaUrls } from "./media-resolve";

const REFRESH_BEFORE_MS = 60 * 60_000;

export type PublishResult =
  | { ok: true; publishId: string }
  | { ok: false; error: string };

function envCreds(): { clientKey: string; clientSecret: string } | null {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) return null;
  return { clientKey, clientSecret };
}

async function ensureFreshToken(
  accountId: string,
  accessToken: string,
  expiresAt: Date | null,
  refreshToken: string | null
): Promise<string> {
  if (!expiresAt || expiresAt.getTime() - Date.now() > REFRESH_BEFORE_MS) {
    return accessToken;
  }
  if (!refreshToken) return accessToken;
  const creds = envCreds();
  if (!creds) return accessToken;

  const refreshed = await refreshAccessToken({
    refreshToken,
    clientKey: creds.clientKey,
    clientSecret: creds.clientSecret,
  });
  const now = Date.now();
  await db
    .update(tiktokAccounts)
    .set({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      tokenExpiresAt: new Date(now + refreshed.expires_in * 1000),
      refreshTokenExpiresAt: refreshed.refresh_expires_in
        ? new Date(now + refreshed.refresh_expires_in * 1000)
        : null,
      scope: refreshed.scope,
      updatedAt: new Date(),
    })
    .where(eq(tiktokAccounts.id, accountId));
  return refreshed.access_token;
}

export async function publishTikTokPost(opts: {
  userId: string;
  post: PostDetail;
}): Promise<PublishResult> {
  const account = await getTiktokAccount(opts.userId);
  if (!account) {
    return { ok: false, error: "Nenhuma conta TikTok conectada — vá em /settings → Conectar TikTok" };
  }

  let token: string;
  try {
    token = await ensureFreshToken(account.id, account.accessToken, account.tokenExpiresAt, account.refreshToken);
  } catch (e) {
    return { ok: false, error: `refresh token: ${e instanceof Error ? e.message : String(e)}` };
  }

  const hasVideo = opts.post.videos.length > 0;
  const filenames = hasVideo ? [opts.post.videos[0]] : opts.post.images;
  if (filenames.length === 0) {
    return { ok: false, error: "Post sem mídia (TikTok exige vídeo ou pelo menos 1 foto)" };
  }

  let resolved;
  try {
    resolved = await resolveMediaUrls(opts.post.slug, filenames, opts.post.userId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  try {
    if (hasVideo) {
      const r = await initInboxVideoPost({ token, videoUrl: resolved[0].url });
      return { ok: true, publishId: r.publishId };
    }
    const r = await initInboxPhotoPost({
      token,
      title: opts.post.title.slice(0, 90),
      description: opts.post.captionTt,
      photoUrls: resolved.map((m) => m.url),
    });
    return { ok: true, publishId: r.publishId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await cleanupTempMedia(resolved);
  }
}
