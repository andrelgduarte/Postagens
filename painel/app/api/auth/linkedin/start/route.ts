import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import {
  STATE_COOKIE,
  buildAuthorizeUrl,
  randomState,
  requiredEnv,
  resolveRedirectUri,
} from "@/lib/linkedin-oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await currentUserId();
  const { clientId } = requiredEnv();
  const redirectUri = resolveRedirectUri(req);
  const state = randomState();
  const url = buildAuthorizeUrl({ clientId, redirectUri, state });

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: redirectUri.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
