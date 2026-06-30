import { NextResponse } from "next/server";
import { logEvent } from "@/lib/publish-log";

export const dynamic = "force-dynamic";

function confirmationCode(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function originFromReq(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "app.andrelgduarte.com.br";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  const body = await req.text().catch(() => "");
  const code = confirmationCode();
  await logEvent({
    event: "publish_fail",
    message: `Threads delete callback: ${code} body=${body.slice(0, 200)}`,
  });
  const url = `${originFromReq(req)}/api/auth/threads/delete?code=${code}`;
  return NextResponse.json({ url, confirmation_code: code });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
