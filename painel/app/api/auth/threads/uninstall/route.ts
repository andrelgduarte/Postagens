import { NextResponse } from "next/server";
import { logEvent } from "@/lib/publish-log";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text().catch(() => "");
  await logEvent({
    event: "publish_fail",
    message: `Threads uninstall callback: ${body.slice(0, 200)}`,
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
