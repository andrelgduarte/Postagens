const SCOPES = ["openid", "profile", "email", "w_member_social"];
const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
export const STATE_COOKIE = "li_oauth_state";

export function requiredEnv(): { clientId: string; clientSecret: string } {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET ausentes");
  }
  return { clientId, clientSecret };
}

export function resolveRedirectUri(req: Request): string {
  const fromEnv = process.env.LINKEDIN_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/auth/linkedin/callback`;
}

export function buildAuthorizeUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: SCOPES.join(" "),
    state: opts.state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export function randomState(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
