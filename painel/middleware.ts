import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

const TIKTOK_VERIFY = {
  path: "/tiktokT2Rt4HieUNv7Y8anDuiCvdD2bAmPxcaK.txt",
  body: "tiktokT2Rt4HieUNv7Y8anDuiCvdD2bAmPxcaK",
};

const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/scheduler(.*)",
  "/api/admin(.*)",
  "/tiktok(.*).txt",
]);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return;
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });
});

export default function middleware(req: NextRequest, ev: Parameters<typeof clerkHandler>[1]) {
  if (req.nextUrl.pathname === TIKTOK_VERIFY.path) {
    return new NextResponse(TIKTOK_VERIFY.body, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (!clerkEnabled) return NextResponse.next();
  return clerkHandler(req, ev);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/img|api/scheduler|api/admin).*)",
    "/",
  ],
};
