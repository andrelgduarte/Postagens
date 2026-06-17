import Link from "next/link";
import { imageUrl, listPosts, type NetworkStatus, type Post } from "@/lib/posts";
import { readInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function parseMonthParam(raw: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const [y, m] = raw.split("-").map(Number);
  return { year: y, month: m };
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // JS: 0=Sun..6=Sat. Quero segunda-início → (getDay()+6)%7
  const leadingBlanks = (first.getDay() + 6) % 7;
  const cells: ({ day: number; date: string } | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: isoDate(year, month, d) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const { year, month } = parseMonthParam(m);
  const allPosts = await listPosts();
  const byDate = new Map<string, Post[]>();
  for (const p of allPosts) {
    if (!byDate.has(p.date)) byDate.set(p.date, []);
    byDate.get(p.date)!.push(p);
  }

  const reachByDate = new Map<string, number>();
  await Promise.all(
    allPosts
      .filter((p) => p.meta.status_ig === "posted")
      .map(async (p) => {
        const ins = await readInsights(p.slug);
        const last = ins.snapshots[ins.snapshots.length - 1];
        const reach = last?.metrics.reach;
        if (typeof reach === "number") {
          reachByDate.set(p.date, (reachByDate.get(p.date) ?? 0) + reach);
        }
      })
  );
  const monthMaxReach = Math.max(0, ...Array.from(reachByDate.values()));

  const cells = buildGrid(year, month);
  const today = new Date().toISOString().slice(0, 10);

  const monthInThis = allPosts.filter((p) =>
    p.date.startsWith(`${year}-${String(month).padStart(2, "0")}`)
  );

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const current = `${year}-${String(month).padStart(2, "0")}`;
  const nowYm = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {MONTH_NAMES[month - 1]} de {year}
          </h1>
          <p className="text-sm text-neutral-500">
            {monthInThis.length} {monthInThis.length === 1 ? "post" : "posts"} nesse mês
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?m=${prev}`}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            ← {MONTH_NAMES[(month + 10) % 12].slice(0, 3)}
          </Link>
          {current !== nowYm && (
            <Link
              href="/calendar"
              className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Hoje
            </Link>
          )}
          <Link
            href={`/calendar?m=${next}`}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            {MONTH_NAMES[month % 12].slice(0, 3)} →
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-px bg-neutral-200 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
        {WEEKDAY_NAMES.map((wd) => (
          <div
            key={wd}
            className="bg-neutral-50 dark:bg-neutral-900 text-xs font-medium text-neutral-500 px-3 py-2"
          >
            {wd}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={i} className="bg-neutral-50/40 dark:bg-neutral-950 min-h-24" />;
          }
          const posts = byDate.get(cell.date) ?? [];
          const isToday = cell.date === today;
          const reach = reachByDate.get(cell.date) ?? 0;
          const heat = heatClass(reach, monthMaxReach);
          return (
            <div
              key={i}
              className={`${heat || "bg-white dark:bg-neutral-900"} min-h-24 p-1.5 flex flex-col gap-1 ${
                isToday ? "ring-1 ring-amber-400" : ""
              }`}
            >
              <span
                className={`text-xs font-mono ${
                  isToday ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-neutral-400"
                }`}
              >
                {cell.day}
              </span>
              <div className="flex flex-col gap-1">
                {posts.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/post/${p.slug}`}
                    className="group flex items-center gap-1.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 p-1 hover:border-neutral-400 dark:hover:border-neutral-600"
                    title={p.title}
                  >
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl(p.slug, p.images[0])}
                        alt=""
                        className="w-6 h-6 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-700 shrink-0" />
                    )}
                    <span className="text-xs line-clamp-1 flex-1 min-w-0">{p.title}</span>
                    <span className="flex gap-0.5 shrink-0">
                      <Dot status={p.meta.status_ig} />
                      <Dot status={p.meta.status_li} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <Dot status="queued" /> na fila
        </span>
        <span className="flex items-center gap-1.5">
          <Dot status="posted" /> publicado
        </span>
        <span className="flex items-center gap-1.5">
          <Dot status="skipped" /> pulado
        </span>
        <span className="flex items-center gap-1.5">
          <Dot status="failed" /> falhou
        </span>
        {monthMaxReach > 0 && (
          <span className="flex items-center gap-1.5">
            reach:
            <span className="inline-block w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/40" />
            <span className="inline-block w-3 h-3 rounded bg-emerald-200 dark:bg-emerald-800/60" />
            <span className="inline-block w-3 h-3 rounded bg-emerald-300 dark:bg-emerald-700/70" />
            <span className="inline-block w-3 h-3 rounded bg-emerald-400 dark:bg-emerald-600/80" />
          </span>
        )}
        <span className="ml-auto">
          Cada post tem 2 pontinhos: <b>IG</b> e <b>LI</b>.
        </span>
      </div>
    </div>
  );
}

function heatClass(reach: number, max: number): string {
  if (reach <= 0 || max <= 0) return "";
  const ratio = reach / max;
  if (ratio >= 0.75) return "bg-emerald-400/80 dark:bg-emerald-600/60";
  if (ratio >= 0.5) return "bg-emerald-300/70 dark:bg-emerald-700/50";
  if (ratio >= 0.25) return "bg-emerald-200/60 dark:bg-emerald-800/40";
  return "bg-emerald-100/50 dark:bg-emerald-900/30";
}

function Dot({ status }: { status: NetworkStatus }) {
  const color =
    status === "posted"
      ? "bg-emerald-500"
      : status === "skipped"
        ? "bg-neutral-400"
        : status === "failed"
          ? "bg-red-500"
          : "bg-amber-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}
