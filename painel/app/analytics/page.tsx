import Link from "next/link";
import { engagement, summarizeAll, type PostInsightsSummary } from "@/lib/insights";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const summary = await summarizeAll();
  const withData = summary.filter((s) => s.last);

  const totals = withData.reduce(
    (acc, s) => {
      const m = s.last!.metrics;
      acc.reach += m.reach ?? 0;
      acc.likes += m.likes ?? 0;
      acc.comments += m.comments ?? 0;
      acc.shares += m.shares ?? 0;
      acc.saved += m.saved ?? 0;
      return acc;
    },
    { reach: 0, likes: 0, comments: 0, shares: 0, saved: 0 }
  );

  const top = [...withData]
    .sort((a, b) => engagement(b.last!.metrics) - engagement(a.last!.metrics))
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-sm text-neutral-500">
          {summary.length} publicado(s) · {withData.length} com snapshot · coleta automática a 24h, 3d e 7d.
        </p>
      </div>

      {summary.length === 0 ? (
        <Empty />
      ) : (
        <>
          <TotalsRow totals={totals} />
          {top.length > 0 && <TopList items={top} />}
          <PostsTable items={summary} />
        </>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center text-neutral-500">
      Nenhum post publicado ainda. Insights aparecem aqui após 24h de cada publicação.
    </div>
  );
}

function TotalsRow({
  totals,
}: {
  totals: { reach: number; likes: number; comments: number; shares: number; saved: number };
}) {
  const cells: [string, number][] = [
    ["reach", totals.reach],
    ["likes", totals.likes],
    ["comments", totals.comments],
    ["shares", totals.shares],
    ["saved", totals.saved],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cells.map(([k, v]) => (
        <div
          key={k}
          className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3"
        >
          <div className="text-xs uppercase tracking-wider text-neutral-500">{k}</div>
          <div className="text-xl font-semibold tabular-nums">{v.toLocaleString("pt-BR")}</div>
        </div>
      ))}
    </div>
  );
}

function TopList({ items }: { items: PostInsightsSummary[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm uppercase tracking-wider text-neutral-500 font-medium">
        Top engajamento
      </h2>
      <ol className="space-y-1.5">
        {items.map((s, i) => (
          <li
            key={s.slug}
            className="flex items-center gap-3 rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-2"
          >
            <span className="font-mono text-neutral-400 text-sm w-5">{i + 1}.</span>
            <Link href={`/post/${s.slug}`} className="text-sm flex-1 truncate hover:underline">
              {s.title}
            </Link>
            <span className="text-xs text-neutral-500 font-mono">
              {engagement(s.last!.metrics).toLocaleString("pt-BR")} eng.
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PostsTable({ items }: { items: PostInsightsSummary[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm uppercase tracking-wider text-neutral-500 font-medium">
        Por post
      </h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-neutral-500 bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Post</th>
              <th className="px-3 py-2 text-right">Reach</th>
              <th className="px-3 py-2 text-right">Likes</th>
              <th className="px-3 py-2 text-right">Comm.</th>
              <th className="px-3 py-2 text-right">Shares</th>
              <th className="px-3 py-2 text-right">Saved</th>
              <th className="px-3 py-2">Snap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {items.map((s) => {
              const m = s.last?.metrics;
              return (
                <tr key={s.slug}>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">{s.date}</td>
                  <td className="px-3 py-2 max-w-[24ch] truncate">
                    <Link href={`/post/${s.slug}`} className="hover:underline">
                      {s.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(m?.reach)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(m?.likes)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(m?.comments)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(m?.shares)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(m?.saved)}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {s.last ? `${s.last.milestone} (${s.snapshots})` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function fmt(n?: number): string {
  if (n === undefined) return "—";
  return n.toLocaleString("pt-BR");
}
