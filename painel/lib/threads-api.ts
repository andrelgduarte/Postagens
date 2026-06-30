const GRAPH_BASE = "https://graph.threads.net";

type GraphError = { error?: { message?: string; type?: string; code?: number } };

export type ShortLivedToken = {
  access_token: string;
  user_id: string;
};

export type LongLivedToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export async function exchangeCode(opts: {
  code: string;
  redirectUri: string;
  appId: string;
  appSecret: string;
}): Promise<ShortLivedToken> {
  const body = new URLSearchParams({
    client_id: opts.appId,
    client_secret: opts.appSecret,
    code: opts.code,
    grant_type: "authorization_code",
    redirect_uri: opts.redirectUri,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as ShortLivedToken & GraphError & { error_message?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Threads token exchange ${res.status}: ${data.error?.message ?? data.error_message ?? JSON.stringify(data).slice(0, 300)}`
    );
  }
  return { access_token: data.access_token, user_id: String(data.user_id) };
}

export async function exchangeLongLived(opts: {
  shortLivedToken: string;
  appSecret: string;
}): Promise<LongLivedToken> {
  const url = new URL(`${GRAPH_BASE}/access_token`);
  url.searchParams.set("grant_type", "th_exchange_token");
  url.searchParams.set("client_secret", opts.appSecret);
  url.searchParams.set("access_token", opts.shortLivedToken);
  const res = await fetch(url.toString());
  const data = (await res.json()) as LongLivedToken & GraphError;
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Threads long-lived exchange ${res.status}: ${data.error?.message ?? JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data;
}

export async function refreshLongLivedToken(opts: { accessToken: string }): Promise<LongLivedToken> {
  const url = new URL(`${GRAPH_BASE}/refresh_access_token`);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", opts.accessToken);
  const res = await fetch(url.toString());
  const data = (await res.json()) as LongLivedToken & GraphError;
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Threads refresh ${res.status}: ${data.error?.message ?? JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data;
}

export type ThreadsUserInfo = {
  id: string;
  username: string;
  threads_profile_picture_url?: string;
};

export async function getUserInfo(token: string): Promise<ThreadsUserInfo> {
  const url = new URL(`${GRAPH_BASE}/v1.0/me`);
  url.searchParams.set("fields", "id,username,threads_profile_picture_url");
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const data = (await res.json()) as ThreadsUserInfo & GraphError;
  if (!res.ok || !data.id) {
    throw new Error(
      `Threads /me ${res.status}: ${data.error?.message ?? JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data;
}

type ContainerResponse = { id?: string } & GraphError;

async function createContainer(opts: {
  token: string;
  userId: string;
  params: Record<string, string | boolean>;
}): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/v1.0/${opts.userId}/threads`);
  url.searchParams.set("access_token", opts.token);
  for (const [k, v] of Object.entries(opts.params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { method: "POST" });
  const data = (await res.json()) as ContainerResponse;
  if (!res.ok || !data.id) {
    throw new Error(
      `Threads create container ${res.status}: ${data.error?.message ?? JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data.id;
}

export async function createTextContainer(opts: {
  token: string;
  userId: string;
  text: string;
}): Promise<string> {
  return createContainer({
    token: opts.token,
    userId: opts.userId,
    params: { media_type: "TEXT", text: opts.text },
  });
}

export async function createImageContainer(opts: {
  token: string;
  userId: string;
  imageUrl: string;
  text?: string;
  isCarouselItem?: boolean;
}): Promise<string> {
  const params: Record<string, string | boolean> = {
    media_type: "IMAGE",
    image_url: opts.imageUrl,
  };
  if (opts.text) params.text = opts.text;
  if (opts.isCarouselItem) params.is_carousel_item = true;
  return createContainer({ token: opts.token, userId: opts.userId, params });
}

export async function createVideoContainer(opts: {
  token: string;
  userId: string;
  videoUrl: string;
  text?: string;
  isCarouselItem?: boolean;
}): Promise<string> {
  const params: Record<string, string | boolean> = {
    media_type: "VIDEO",
    video_url: opts.videoUrl,
  };
  if (opts.text) params.text = opts.text;
  if (opts.isCarouselItem) params.is_carousel_item = true;
  return createContainer({ token: opts.token, userId: opts.userId, params });
}

export async function createCarouselContainer(opts: {
  token: string;
  userId: string;
  childrenIds: string[];
  text?: string;
}): Promise<string> {
  const params: Record<string, string | boolean> = {
    media_type: "CAROUSEL",
    children: opts.childrenIds.join(","),
  };
  if (opts.text) params.text = opts.text;
  return createContainer({ token: opts.token, userId: opts.userId, params });
}

export type ContainerStatus = {
  status: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
  error_message?: string;
};

export async function getContainerStatus(opts: {
  token: string;
  containerId: string;
}): Promise<ContainerStatus> {
  const url = new URL(`${GRAPH_BASE}/v1.0/${opts.containerId}`);
  url.searchParams.set("fields", "status,error_message");
  url.searchParams.set("access_token", opts.token);
  const res = await fetch(url.toString());
  const data = (await res.json()) as ContainerStatus & GraphError;
  if (!res.ok) {
    throw new Error(
      `Threads container status ${res.status}: ${data.error?.message ?? JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data;
}

export async function publishContainer(opts: {
  token: string;
  userId: string;
  containerId: string;
}): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/v1.0/${opts.userId}/threads_publish`);
  url.searchParams.set("creation_id", opts.containerId);
  url.searchParams.set("access_token", opts.token);
  const res = await fetch(url.toString(), { method: "POST" });
  const data = (await res.json()) as { id?: string } & GraphError;
  if (!res.ok || !data.id) {
    throw new Error(
      `Threads publish ${res.status}: ${data.error?.message ?? JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data.id;
}
