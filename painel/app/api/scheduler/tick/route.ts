import { NextResponse } from "next/server";
import { runTick } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // dev mode: liberado quando secret ausente
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(req.url).searchParams.get("dry") === "1";
  try {
    const result = await runTick({ dryRun, notify: false });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
