import Link from "next/link";
import { readEventLog } from "@/lib/publish-log";

export const dynamic = "force-dynamic";

const EVENT_COLOR: Record<string, string> = {
  tick_start: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  tick_end: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  due: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  skip: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  publish_start: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  publish_ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  publish_fail: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  retry_scheduled: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  give_up: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200",
};

function fmtRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export default async function LogsPage() {
  const events = await readEventLog(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-neutral-500">
          Últimos {events.length} evento(s) do scheduler. Mais recentes primeiro.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-sm text-neutral-500">
          Nenhum evento registrado ainda.
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-neutral-500 bg-neutral-50 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2 w-24">Quando</th>
                <th className="px-3 py-2 w-32">Evento</th>
                <th className="px-3 py-2">Post / Mensagem</th>
                <th className="px-3 py-2 w-32">Conta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {events.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="px-3 py-2 text-xs text-neutral-500 font-mono whitespace-nowrap" title={e.ts}>
                    {fmtRelative(e.ts)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${
                        EVENT_COLOR[e.event] ?? "bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      {e.event}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {e.slug && (
                      <Link
                        href={`/post/${e.slug}`}
                        className="font-mono text-xs text-neutral-700 dark:text-neutral-300 hover:underline"
                      >
                        {e.slug}
                      </Link>
                    )}
                    {e.message && (
                      <div className="text-xs text-neutral-500 mt-0.5 whitespace-pre-wrap">{e.message}</div>
                    )}
                    {e.attempt && (
                      <div className="text-[11px] text-neutral-400 mt-0.5">tentativa #{e.attempt}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{e.account ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
