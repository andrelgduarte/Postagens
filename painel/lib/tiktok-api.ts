const OPEN_BASE = "https://open.tiktokapis.com";

type TokenError = { error?: string; error_description?: string };

export type TokenResponse = {
  open_id: string;
  scope: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  token_type: string;
};

export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
  clientKey: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_key: opts.clientKey,
    client_secret: opts.clientSecret,
    code: opts.code,
    grant_type: "authorization_code",
    redirect_uri: opts.redirectUri,
  });
  const res = await fetch(`${OPEN_BASE}/v2/oauth/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as TokenResponse & TokenError;
  if (!res.ok || data.error) {
    throw new Error(
      `TikTok token exchange ${res.status}: ${data.error_description ?? data.error ?? JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data;
}

export async function refreshAccessToken(opts: {
  refreshToken: string;
  clientKey: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_key: opts.clientKey,
    client_secret: opts.clientSecret,
    grant_type: "refresh_token",
    refresh_token: opts.refreshToken,
  });
  const res = await fetch(`${OPEN_BASE}/v2/oauth/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as TokenResponse & TokenError;
  if (!res.ok || data.error) {
    throw new Error(
      `TikTok refresh ${res.status}: ${data.error_description ?? data.error ?? JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data;
}

export type UserInfo = {
  open_id: string;
  union_id?: string;
  display_name: string;
  avatar_url?: string;
};

export async function getUserInfo(token: string): Promise<UserInfo> {
  const url = `${OPEN_BASE}/v2/user/info/?fields=${encodeURIComponent("open_id,union_id,avatar_url,display_name")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    data?: { user?: UserInfo };
    error?: { code: string; message: string };
  };
  if (!res.ok || !json.data?.user) {
    throw new Error(`TikTok userinfo ${res.status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 300)}`);
  }
  return json.data.user;
}

type PublishInitResponse = {
  data?: { publish_id: string; upload_url?: string };
  error?: { code: string; message: string; log_id?: string };
};

async function postPublish(opts: { token: string; path: string; body: unknown }): Promise<{ publishId: string }> {
  const res = await fetch(`${OPEN_BASE}${opts.path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "content-type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(opts.body),
  });
  const data = (await res.json()) as PublishInitResponse;
  if (!res.ok || !data.data?.publish_id || (data.error && data.error.code !== "ok")) {
    const msg = data.error?.message ?? `status ${res.status}`;
    const code = data.error?.code ?? "unknown";
    throw new Error(`TikTok ${opts.path} ${code}: ${msg}`);
  }
  return { publishId: data.data.publish_id };
}

export async function initInboxVideoPost(opts: {
  token: string;
  videoUrl: string;
}): Promise<{ publishId: string }> {
  return postPublish({
    token: opts.token,
    path: "/v2/post/publish/inbox/video/init/",
    body: { source_info: { source: "PULL_FROM_URL", video_url: opts.videoUrl } },
  });
}

export async function initInboxPhotoPost(opts: {
  token: string;
  title: string;
  description: string;
  photoUrls: string[];
}): Promise<{ publishId: string }> {
  return postPublish({
    token: opts.token,
    path: "/v2/post/publish/content/init/",
    body: {
      media_type: "PHOTO",
      post_mode: "MEDIA_UPLOAD",
      post_info: {
        title: opts.title.slice(0, 90),
        description: opts.description.slice(0, 4000),
        disable_comment: false,
        auto_add_music: true,
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_images: opts.photoUrls,
        photo_cover_index: 0,
      },
    },
  });
}

export type PublishStatus = {
  status: string;
  fail_reason?: string;
  publicaly_available_post_id?: string[];
};

export async function fetchPublishStatus(opts: {
  token: string;
  publishId: string;
}): Promise<PublishStatus> {
  const res = await fetch(`${OPEN_BASE}/v2/post/publish/status/fetch/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "content-type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ publish_id: opts.publishId }),
  });
  const data = (await res.json()) as { data?: PublishStatus; error?: { code: string; message: string } };
  if (!res.ok || !data.data) {
    throw new Error(`TikTok status ${data.error?.code ?? res.status}: ${data.error?.message ?? "?"}`);
  }
  return data.data;
}
