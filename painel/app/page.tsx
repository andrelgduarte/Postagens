import Link from "next/link";
import { listPosts } from "@/lib/posts";
import { listAccounts } from "@/lib/config";
import { FilaView } from "./fila-view";

export const dynamic = "force-dynamic";

export default async function FilaPage() {
  const [posts, accounts] = await Promise.all([listPosts(), listAccounts()]);

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
        <FilaView
          upcoming={upcoming}
          past={past}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        />
      )}
    </div>
  );
}
