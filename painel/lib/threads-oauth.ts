const SCOPES = ["threads_basic", "threads_content_publish"];
const AUTHORIZE_URL = "https://www.threads.net/oauth/authorize";
export const STATE_COOKIE = "th_oauth_state";

export function requiredEnv(): { appId: string; appSecret: string } {
  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("THREADS_APP_ID/THREADS_APP_SECRET ausentes");
  }
  return { appId, appSecret };
}

export function resolveRedirectUri(req: Request): string {
  const fromEnv = process.env.THREADS_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/auth/threads/callback`;
}

export function buildAuthorizeUrl(opts: { appId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: opts.appId,
    redirect_uri: opts.redirectUri,
    scope: SCOPES.join(","),
    response_type: "code",
    state: opts.state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export function randomState(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
