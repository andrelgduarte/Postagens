import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { logEvent } from "@/lib/publish-log";
import { exchangeCode, getUserInfo } from "@/lib/tiktok-api";
import { upsertTiktokAccount } from "@/lib/tiktok-accounts";
import {
  STATE_COOKIE,
  requiredEnv,
  resolveRedirectUri,
} from "@/lib/tiktok-oauth";

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
      message: `TikTok OAuth callback erro: ${error} ${errorDescription ?? ""}`,
    });
    return redirectToSettings(req, { tt_error: errorDescription ?? error });
  }

  if (!code || !state) {
    return redirectToSettings(req, { tt_error: "callback sem code/state" });
  }

  const expectedState = req.headers.get("cookie")?.match(/(?:^|; )tt_oauth_state=([^;]+)/)?.[1];
  if (!expectedState || expectedState !== state) {
    return redirectToSettings(req, { tt_error: "state inválido (CSRF)" });
  }

  try {
    const { clientKey, clientSecret } = requiredEnv();
    const redirectUri = resolveRedirectUri(req);
    const token = await exchangeCode({ code, redirectUri, clientKey, clientSecret });
    const info = await getUserInfo(token.access_token);

    const now = Date.now();
    await upsertTiktokAccount({
      userId,
      openId: token.open_id,
      unionId: info.union_id ?? null,
      displayName: info.display_name || token.open_id,
      avatarUrl: info.avatar_url ?? null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiresAt: new Date(now + token.expires_in * 1000),
      refreshTokenExpiresAt: token.refresh_expires_in
        ? new Date(now + token.refresh_expires_in * 1000)
        : null,
      scope: token.scope,
    });

    await logEvent({
      event: "publish_ok",
      message: `TikTok conectado: ${info.display_name ?? token.open_id}`,
    });

    return redirectToSettings(req, { tt_ok: "1" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logEvent({ event: "publish_fail", message: `TikTok OAuth: ${message}` });
    return redirectToSettings(req, { tt_error: message });
  }
}
