import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { linkedinAccounts } from "./db/schema";
import { getLinkedinAccount } from "./linkedin-accounts";
import {
  createImagePost,
  createMultiImagePost,
  createTextPost,
  refreshAccessToken,
  uploadImageFromUrl,
} from "./linkedin-api";
import { imageUrl } from "./posts";
import type { PostDetail } from "./posts";

const REFRESH_BEFORE_MS = 7 * 86_400_000; // refresh if token expires in 7 days or less

export type PublishResult =
  | { ok: true; postUrn: string }
  | { ok: false; error: string };

function envCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function ensureFreshToken(accountId: string, accessToken: string, expiresAt: Date | null, refreshToken: string | null): Promise<string> {
  if (!expiresAt || expiresAt.getTime() - Date.now() > REFRESH_BEFORE_MS) {
    return accessToken;
  }
  if (!refreshToken) return accessToken;
  const creds = envCreds();
  if (!creds) return accessToken;

  const refreshed = await refreshAccessToken({
    refreshToken,
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
  });
  const now = Date.now();
  await db
    .update(linkedinAccounts)
    .set({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      tokenExpiresAt: new Date(now + refreshed.expires_in * 1000),
      refreshTokenExpiresAt: refreshed.refresh_token_expires_in
        ? new Date(now + refreshed.refresh_token_expires_in * 1000)
        : null,
      scope: refreshed.scope,
      updatedAt: new Date(),
    })
    .where(eq(linkedinAccounts.id, accountId));
  return refreshed.access_token;
}

function publicMediaUrl(baseUrl: string | undefined, slug: string, filename: string): string {
  if (!baseUrl) return imageUrl(slug, filename);
  return `${baseUrl.replace(/\/$/, "")}${imageUrl(slug, filename)}`;
}

export async function publishLinkedInPost(opts: {
  userId: string;
  post: PostDetail;
  baseUrl?: string;
}): Promise<PublishResult> {
  const account = await getLinkedinAccount(opts.userId);
  if (!account) {
    return { ok: false, error: "Nenhuma conta LinkedIn conectada — vá em /settings → Conectar LinkedIn" };
  }

  let token: string;
  try {
    token = await ensureFreshToken(account.id, account.accessToken, account.tokenExpiresAt, account.refreshToken);
  } catch (e) {
    return { ok: false, error: `refresh token: ${e instanceof Error ? e.message : String(e)}` };
  }

  const commentary = opts.post.captionLi;
  const ownerUrn = account.personUrn;
  const images = opts.post.images;

  try {
    if (images.length === 0) {
      const r = await createTextPost({ token, ownerUrn, commentary });
      return { ok: true, postUrn: r.postUrn };
    }

    const urls = images.map((f) => publicMediaUrl(opts.baseUrl, opts.post.slug, f));

    if (images.length === 1) {
      const imageUrn = await uploadImageFromUrl({ token, ownerUrn, url: urls[0] });
      const r = await createImagePost({ token, ownerUrn, commentary, imageUrn });
      return { ok: true, postUrn: r.postUrn };
    }

    const imageUrns = await Promise.all(
      urls.map((url) => uploadImageFromUrl({ token, ownerUrn, url }))
    );
    const r = await createMultiImagePost({
      token,
      ownerUrn,
      commentary,
      images: imageUrns.map((urn) => ({ urn })),
    });
    return { ok: true, postUrn: r.postUrn };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
