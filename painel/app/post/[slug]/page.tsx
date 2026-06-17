import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, imageUrl } from "@/lib/posts";
import { listAccounts } from "@/lib/config";
import { PostEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, accounts] = await Promise.all([getPost(slug), listAccounts()]);
  if (!post) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
          ← voltar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{post.title}</h1>
        <p className="text-sm font-mono text-neutral-500">
          {post.slug} · {post.images.length} {post.images.length === 1 ? "imagem" : "imagens"}
          {post.videos.length > 0 && ` · ${post.videos.length} vídeo${post.videos.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <MediaPreview slug={post.slug} images={post.images} videos={post.videos} />

      <PostEditor
        slug={post.slug}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, is_default: a.is_default }))}
        initial={{
          captionIg: post.captionIg,
          captionLi: post.captionLi,
          meta: post.meta,
        }}
      />
    </div>
  );
}

function MediaPreview({
  slug,
  images,
  videos,
}: {
  slug: string;
  images: string[];
  videos: string[];
}) {
  if (images.length === 0 && videos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center text-neutral-500">
        Sem mídia.
      </div>
    );
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
      {videos.map((v) => (
        <div
          key={v}
          className="relative shrink-0 w-72 aspect-square rounded-lg overflow-hidden bg-black snap-start"
        >
          <video
            src={imageUrl(slug, v)}
            controls
            className="w-full h-full object-contain"
          />
          <span className="absolute bottom-2 left-2 rounded bg-black/60 text-white text-xs px-1.5 py-0.5">
            {v}
          </span>
        </div>
      ))}
      {images.map((img, idx) => (
        <div
          key={img}
          className="relative shrink-0 w-72 aspect-square rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 snap-start"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(slug, img)} alt={img} className="w-full h-full object-cover" />
          <span className="absolute bottom-2 left-2 rounded bg-black/60 text-white text-xs px-1.5 py-0.5">
            {idx + 1} / {images.length}
          </span>
        </div>
      ))}
    </div>
  );
}
