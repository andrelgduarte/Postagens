const GRAPH_BASE = "https://graph.facebook.com";

type DebugTokenResponse = {
  data?: {
    expires_at?: number;
    is_valid?: boolean;
    scopes?: string[];
    type?: string;
    error?: { message?: string };
  };
  error?: { message?: string };
};

type ExchangeTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: { message?: string };
};

export type TokenInfo = {
  valid: boolean;
  expiresAt: Date | null;
  error?: string;
};

export async function inspectToken(opts: {
  token: string;
  appId: string;
  appSecret: string;
  version?: string;
}): Promise<TokenInfo> {
  const version = opts.version ?? "v22.0";
  const appToken = `${opts.appId}|${opts.appSecret}`;
  const url = `${GRAPH_BASE}/${version}/debug_token?input_token=${encodeURIComponent(
    opts.token
  )}&access_token=${encodeURIComponent(appToken)}`;
  const res = await fetch(url);
  const data = (await res.json()) as DebugTokenResponse;
  if (!res.ok || data.error) {
    return {
      valid: false,
      expiresAt: null,
      error: data.error?.message ?? `Graph ${res.status}`,
    };
  }
  const expiresAtSec = data.data?.expires_at;
  return {
    valid: Boolean(data.data?.is_valid),
    expiresAt:
      expiresAtSec && expiresAtSec > 0 ? new Date(expiresAtSec * 1000) : null,
  };
}

export type ExtendResult = {
  ok: boolean;
  token?: string;
  expiresAt?: Date | null;
  error?: string;
};

export async function extendToken(opts: {
  appId: string;
  appSecret: string;
  currentToken: string;
  version?: string;
}): Promise<ExtendResult> {
  const version = opts.version ?? "v22.0";
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: opts.appId,
    client_secret: opts.appSecret,
    fb_exchange_token: opts.currentToken,
  });
  const url = `${GRAPH_BASE}/${version}/oauth/access_token?${params.toString()}`;
  const res = await fetch(url);
  const data = (await res.json()) as ExchangeTokenResponse;
  if (!res.ok || data.error || !data.access_token) {
    return { ok: false, error: data.error?.message ?? `Graph ${res.status}` };
  }
  const expiresAt =
    typeof data.expires_in === "number" && data.expires_in > 0
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;
  return { ok: true, token: data.access_token, expiresAt };
}
