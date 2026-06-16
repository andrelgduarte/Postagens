"use client";

import { useEffect, useRef, useState } from "react";

type DuePost = {
  slug: string;
  title: string;
  networks: string[];
  scheduled?: string;
};

type Permission = "default" | "granted" | "denied" | "unsupported";

const POLL_MS = 60_000;

export function NotificationsWatcher() {
  const notifiedRef = useRef<Set<string>>(new Set());
  const [perm, setPerm] = useState<Permission>("default");
  const [recent, setRecent] = useState<DuePost[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission as Permission);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/due", { cache: "no-store" });
        if (!res.ok) return;
        const due = (await res.json()) as DuePost[];
        if (cancelled) return;

        setRecent(due);

        for (const d of due) {
          if (notifiedRef.current.has(d.slug)) continue;
          notifiedRef.current.add(d.slug);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const n = new Notification(`Hora de postar: ${d.title}`, {
              body: `Pendente em: ${d.networks.join(", ")}`,
              tag: d.slug,
              requireInteraction: true,
            });
            n.onclick = () => {
              window.focus();
              window.location.href = `/post/${d.slug}`;
              n.close();
            };
          }
        }
      } catch {
        // silencioso — vai tentar de novo
      }
    }

    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPerm(result as Permission);
  }

  if (perm === "denied" || perm === "unsupported") return null;

  if (perm === "default") {
    return (
      <button
        type="button"
        onClick={requestPermission}
        className="fixed bottom-4 right-4 rounded-md bg-amber-500 text-white text-sm font-medium px-3 py-2 shadow-lg hover:bg-amber-600 z-20"
      >
        Habilitar notificações
      </button>
    );
  }

  if (recent.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 rounded-md bg-emerald-600 text-white text-xs px-3 py-2 shadow-lg z-20">
      {recent.length} post{recent.length === 1 ? "" : "s"} no horário
    </div>
  );
}
