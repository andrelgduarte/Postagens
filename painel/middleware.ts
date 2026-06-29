import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/scheduler(.*)",
  "/api/admin(.*)",
  "/terms",
  "/privacy",
]);

export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (isPublic(req)) return;
      const { userId, redirectToSignIn } = await auth();
      if (!userId) return redirectToSignIn({ returnBackUrl: req.url });
    })
  : function passthrough() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/img|api/scheduler|api/admin|tiktok).*)",
    "/",
  ],
};
