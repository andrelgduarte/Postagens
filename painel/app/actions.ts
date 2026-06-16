"use server";

import { revalidatePath } from "next/cache";
import {
  createPost,
  getPost,
  type NetworkStatus,
  writeCaption,
  writeMeta,
} from "@/lib/posts";

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

export async function publishInstagramAction(slug: string): Promise<{ postId: string }> {
  const post = await getPost(slug);
  if (!post) throw new Error("Post não encontrado");
  if (post.meta.status_ig === "posted") throw new Error("Já publicado no Instagram");
  if (!post.captionIg.trim()) throw new Error("Legenda do Instagram está vazia");

  const { publishInstagram } = await import("@/lib/instagram");
  const { postId } = await publishInstagram({
    slug,
    images: post.images,
    caption: post.captionIg,
  });

  await writeMeta(slug, {
    ...post.meta,
    status_ig: "posted",
    ig_post_id: postId,
  });
  revalidatePath("/");
  revalidatePath(`/post/${slug}`);
  return { postId };
}

export async function createPostAction(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const title = String(formData.get("title") ?? "");
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
  const slug = await createPost({ date, title: title || "post", images });
  revalidatePath("/");
  return slug;
}
