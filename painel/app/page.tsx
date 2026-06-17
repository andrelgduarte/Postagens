import Link from "next/link";
import { imageUrl, listPosts, type NetworkStatus, type PostType } from "@/lib/posts";

const TYPE_LABEL: Record<PostType, string> = {
  single: "imagem",
  carousel: "carrossel",
  reel: "reel",
  story: "story",
};

export const dynamic = "force-dynamic";

function StatusBadge({ label, status }: { label: string; status: NetworkStatus }) {
  const color =
    status === "posted"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "skipped"
        ? "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
        : status === "failed"
          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${color}`}>
      {label} · {status}
    </span>
  );
}

export default async function FilaPage() {
  const posts = await listPosts();

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = posts.filter((p) => p.date >= today);
  const past = posts.filter((p) => p.date < today).reverse();

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fila de postagens</h1>
          <p className="text-sm text-neutral-500">
            {posts.length} {posts.length === 1 ? "post" : "posts"} · {upcoming.length} agendados ·{" "}
            {past.length} no passado
          </p>
        </div>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center">
          <p className="text-neutral-500 mb-4">Nenhum post ainda.</p>
          <Link
            href="/new"
            className="inline-flex rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Criar primeiro post
          </Link>
        </div>
      ) : (
        <>
          <Section title="Agendados / hoje" posts={upcoming} />
          <Section title="Publicados / passados" posts={past} />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  posts,
}: {
  title: string;
  posts: Awaited<ReturnType<typeof listPosts>>;
}) {
  if (posts.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm uppercase tracking-wider text-neutral-500 font-medium">{title}</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/post/${p.slug}`}
              className="group block rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-neutral-100 dark:bg-neutral-800 relative overflow-hidden">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(p.slug, p.images[0])}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                  />
                ) : p.videos[0] ? (
                  <video
                    src={imageUrl(p.slug, p.videos[0])}
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-400 text-sm">
                    sem mídia
                  </div>
                )}
                {p.meta.type && (
                  <span className="absolute top-2 left-2 rounded bg-black/60 text-white text-xs px-1.5 py-0.5">
                    {TYPE_LABEL[p.meta.type]}
                  </span>
                )}
                {p.images.length > 1 && (
                  <span className="absolute top-2 right-2 rounded bg-black/60 text-white text-xs px-1.5 py-0.5">
                    {p.images.length} imgs
                  </span>
                )}
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-neutral-500">{p.date}</span>
                  {p.meta.scheduled && (
                    <span className="text-xs text-neutral-400">
                      {p.meta.scheduled.slice(11, 16) || ""}
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-sm line-clamp-1">{p.title}</h3>
                <div className="flex flex-wrap gap-1">
                  <StatusBadge label="IG" status={p.meta.status_ig} />
                  <StatusBadge label="LI" status={p.meta.status_li} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
