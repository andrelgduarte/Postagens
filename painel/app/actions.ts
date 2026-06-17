"use server";

import { revalidatePath } from "next/cache";
import {
  createPost,
  deletePostBySlug,
  getPost,
  type NetworkStatus,
  type PostType,
  writeCaption,
  writeMeta,
} from "@/lib/posts";

export async function resetRetry(slug: string) {
  const post = await getPost(slug);
  if (!post) throw new Error("Post não encontrado");
  const meta = {
    ...post.meta,
    status_ig: "queued" as NetworkStatus,
    attempts: 0,
    last_attempt: undefined,
    last_error: undefined,
  };
  await writeMeta(slug, meta);
  revalidatePath("/");
  revalidatePath(`/post/${slug}`);
}

export async function updateStatus(
  slug: string,
  network: "ig" | "li",
  status: NetworkStatus
) {
  const post = await getPost(slug);
  if (!post) throw new Error("Post não encontrado");
  const meta = { ...post.meta };
  if (network === "ig") meta.status_ig = status;
  else meta.status_li = status;
  await writeMeta(slug, meta);
  revalidatePath("/");
  revalidatePath(`/post/${slug}`);
}

export async function saveCaption(
  slug: string,
  network: "ig" | "li",
  content: string
) {
  await writeCaption(slug, network, content);
  revalidatePath(`/post/${slug}`);
}

export async function saveSchedule(slug: string, scheduled: string) {
  const post = await getPost(slug);
  if (!post) throw new Error("Post não encontrado");
  await writeMeta(slug, { ...post.meta, scheduled: scheduled || undefined });
  revalidatePath("/");
  revalidatePath(`/post/${slug}`);
}

export async function saveType(slug: string, type: PostType) {
  const post = await getPost(slug);
  if (!post) throw new Error("Post não encontrado");
  await writeMeta(slug, { ...post.meta, type });
  revalidatePath(`/post/${slug}`);
}

export async function saveAutoPublish(slug: string, auto_publish: boolean) {
  const post = await getPost(slug);
  if (!post) throw new Error("Post não encontrado");
  await writeMeta(slug, { ...post.meta, auto_publish });
  revalidatePath(`/post/${slug}`);
}

export async function bulkSetAutoPublish(
  slugs: string[],
  auto_publish: boolean
): Promise<{ updated: number }> {
  let updated = 0;
  for (const slug of slugs) {
    const post = await getPost(slug);
    if (!post) continue;
    await writeMeta(slug, { ...post.meta, auto_publish });
    updated += 1;
  }
  revalidatePath("/");
  return { updated };
}

export async function bulkSetAccount(
  slugs: string[],
  account_id: string
): Promise<{ updated: number }> {
  let updated = 0;
  for (const slug of slugs) {
    const post = await getPost(slug);
    if (!post) continue;
    await writeMeta(slug, { ...post.meta, account_id: account_id || undefined });
    updated += 1;
  }
  revalidatePath("/");
  return { updated };
}

export async function bulkDelete(slugs: string[]): Promise<{ deleted: number }> {
  let deleted = 0;
  for (const slug of slugs) {
    const ok = await deletePostBySlug(slug);
    if (ok) deleted += 1;
  }
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/analytics");
  return { deleted };
}

export async function saveAccount(slug: string, account_id: string) {
  const post = await getPost(slug);
  if (!post) throw new Error("Post não encontrado");
  await writeMeta(slug, {
    ...post.meta,
    account_id: account_id || undefined,
  });
  revalidatePath(`/post/${slug}`);
}

export async function publishInstagramAction(
  slug: string
): Promise<{ postId: string; accountName: string }> {
  const post = await getPost(slug);
  if (!post) throw new Error("Post não encontrado");
  if (post.meta.status_ig === "posted") throw new Error("Já publicado no Instagram");
  const type: PostType =
    post.meta.type ?? (post.videos.length > 0 ? "reel" : post.images.length >= 2 ? "carousel" : "single");
  if (type !== "story" && !post.captionIg.trim()) {
    throw new Error("Legenda do Instagram está vazia");
  }

  const { publishInstagram } = await import("@/lib/instagram");
  const { postId, accountName } = await publishInstagram({
    slug,
    type,
    images: post.images,
    videos: post.videos,
    caption: post.captionIg,
    accountId: post.meta.account_id,
  });

  await writeMeta(slug, {
    ...post.meta,
    status_ig: "posted",
    ig_post_id: postId,
    published_at: new Date().toISOString(),
  });
  revalidatePath("/");
  revalidatePath(`/post/${slug}`);
  return { postId, accountName };
}

export async function createPostAction(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const title = String(formData.get("title") ?? "");
  const type = (formData.get("type") as PostType | null) ?? undefined;
  const account_id = String(formData.get("account_id") ?? "") || undefined;
  const auto_publish_raw = formData.get("auto_publish");
  const auto_publish =
    auto_publish_raw === null ? undefined : auto_publish_raw === "true" || auto_publish_raw === "on";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Data inválida (YYYY-MM-DD)");
  }
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Envie ao menos uma imagem");
  const images = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
    }))
  );
  const slug = await createPost({
    date,
    title: title || "post",
    images,
    type,
    auto_publish,
    account_id,
  });
  revalidatePath("/");
  return slug;
}
