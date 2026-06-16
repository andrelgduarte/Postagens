import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, imageUrl } from "@/lib/posts";
import { PostEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
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
        </p>
      </div>

      <Carousel slug={post.slug} images={post.images} />

      <PostEditor
        slug={post.slug}
        initial={{
          captionIg: post.captionIg,
          captionLi: post.captionLi,
          meta: post.meta,
        }}
      />
    </div>
  );
}

function Carousel({ slug, images }: { slug: string; images: string[] }) {
  if (images.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center text-neutral-500">
        Sem imagens.
      </div>
    );
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
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
