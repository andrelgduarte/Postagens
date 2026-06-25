const LI_VERSION = "202506";
const REST_BASE = "https://api.linkedin.com/rest";
const V2_BASE = "https://api.linkedin.com/v2";
const OAUTH_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": LI_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

export type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
};

export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn token exchange ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(opts: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn refresh ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

export type UserInfo = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
};

export async function getUserInfo(token: string): Promise<UserInfo> {
  const res = await fetch(`${V2_BASE}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`userinfo ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as UserInfo;
}

export function personUrnFromSub(sub: string): string {
  return `urn:li:person:${sub}`;
}

type InitImageUploadResponse = {
  value: {
    uploadUrl: string;
    image: string;
    uploadUrlExpiresAt: number;
  };
};

async function initializeImageUpload(token: string, ownerUrn: string): Promise<{
  uploadUrl: string;
  imageUrn: string;
}> {
  const res = await fetch(`${REST_BASE}/images?action=initializeUpload`, {
    method: "POST",
    headers: { ...authHeaders(token), "content-type": "application/json" },
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`initializeUpload ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as InitImageUploadResponse;
  return { uploadUrl: data.value.uploadUrl, imageUrn: data.value.image };
}

async function uploadBinary(uploadUrl: string, token: string, buffer: ArrayBuffer, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": contentType,
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`uploadBinary ${res.status}: ${text.slice(0, 300)}`);
  }
}

export async function uploadImageFromUrl(opts: {
  token: string;
  ownerUrn: string;
  url: string;
}): Promise<string> {
  const fetchRes = await fetch(opts.url);
  if (!fetchRes.ok) {
    throw new Error(`fetch image ${fetchRes.status} from ${opts.url}`);
  }
  const contentType = fetchRes.headers.get("content-type") ?? "image/png";
  const buffer = await fetchRes.arrayBuffer();

  const { uploadUrl, imageUrn } = await initializeImageUpload(opts.token, opts.ownerUrn);
  await uploadBinary(uploadUrl, opts.token, buffer, contentType);
  return imageUrn;
}

export type CreatePostResult = {
  postUrn: string;
};

export async function createTextPost(opts: {
  token: string;
  ownerUrn: string;
  commentary: string;
}): Promise<CreatePostResult> {
  return createPost({
    token: opts.token,
    body: {
      author: opts.ownerUrn,
      commentary: opts.commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    },
  });
}

export async function createImagePost(opts: {
  token: string;
  ownerUrn: string;
  commentary: string;
  imageUrn: string;
  altText?: string;
}): Promise<CreatePostResult> {
  return createPost({
    token: opts.token,
    body: {
      author: opts.ownerUrn,
      commentary: opts.commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          id: opts.imageUrn,
          ...(opts.altText ? { altText: opts.altText } : {}),
        },
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    },
  });
}

export async function createMultiImagePost(opts: {
  token: string;
  ownerUrn: string;
  commentary: string;
  images: { urn: string; altText?: string }[];
}): Promise<CreatePostResult> {
  return createPost({
    token: opts.token,
    body: {
      author: opts.ownerUrn,
      commentary: opts.commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        multiImage: {
          images: opts.images.map((img) => ({
            id: img.urn,
            ...(img.altText ? { altText: img.altText } : {}),
          })),
        },
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    },
  });
}

async function createPost(opts: { token: string; body: unknown }): Promise<CreatePostResult> {
  const res = await fetch(`${REST_BASE}/posts`, {
    method: "POST",
    headers: { ...authHeaders(opts.token), "content-type": "application/json" },
    body: JSON.stringify(opts.body),
  });
  if (res.status < 200 || res.status >= 300) {
    const text = await res.text().catch(() => "");
    throw new Error(`createPost ${res.status}: ${text.slice(0, 400)}`);
  }
  const postUrn = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id") ?? "";
  return { postUrn };
}
