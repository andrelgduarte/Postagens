import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { logEvent } from "@/lib/publish-log";
import { exchangeCode, exchangeLongLived, getUserInfo } from "@/lib/threads-api";
import { upsertThreadsAccount } from "@/lib/threads-accounts";
import {
  STATE_COOKIE,
  requiredEnv,
  resolveRedirectUri,
} from "@/lib/threads-oauth";

export const dynamic = "force-dynamic";

function redirectToSettings(req: Request, params: Record<string, string>): NextResponse {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const url = new URL(`${proto}://${host}/settings`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(req: Request) {
  const userId = await currentUserId();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    await logEvent({
      event: "publish_fail",
      message: `Threads OAuth callback erro: ${error} ${errorDescription ?? ""}`,
    });
    return redirectToSettings(req, { th_error: errorDescription ?? error });
  }

  if (!code || !state) {
    return redirectToSettings(req, { th_error: "callback sem code/state" });
  }

  const expectedState = req.headers.get("cookie")?.match(/(?:^|; )th_oauth_state=([^;]+)/)?.[1];
  if (!expectedState || expectedState !== state) {
    return redirectToSettings(req, { th_error: "state inválido (CSRF)" });
  }

  try {
    const { appId, appSecret } = requiredEnv();
    const redirectUri = resolveRedirectUri(req);
    const shortLived = await exchangeCode({ code, redirectUri, appId, appSecret });
    const longLived = await exchangeLongLived({
      shortLivedToken: shortLived.access_token,
      appSecret,
    });
    const info = await getUserInfo(longLived.access_token);

    const now = Date.now();
    await upsertThreadsAccount({
      userId,
      threadsUserId: info.id,
      username: info.username,
      avatarUrl: info.threads_profile_picture_url ?? null,
      accessToken: longLived.access_token,
      tokenExpiresAt: new Date(now + longLived.expires_in * 1000),
      scope: "threads_basic,threads_content_publish",
    });

    await logEvent({
      event: "publish_ok",
      message: `Threads conectado: ${info.username}`,
    });

    return redirectToSettings(req, { th_ok: "1" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logEvent({ event: "publish_fail", message: `Threads OAuth: ${message}` });
    return redirectToSettings(req, { th_error: message });
  }
}
