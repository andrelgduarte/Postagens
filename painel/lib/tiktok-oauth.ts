const SCOPES = ["user.info.basic", "video.upload"];
const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const STATE_COOKIE = "tt_oauth_state";

export function requiredEnv(): { clientKey: string; clientSecret: string } {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error("TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET ausentes");
  }
  return { clientKey, clientSecret };
}

export function resolveRedirectUri(req: Request): string {
  const fromEnv = process.env.TIKTOK_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/auth/tiktok/callback`;
}

export function buildAuthorizeUrl(opts: { clientKey: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_key: opts.clientKey,
    scope: SCOPES.join(","),
    response_type: "code",
    redirect_uri: opts.redirectUri,
    state: opts.state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export function randomState(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
