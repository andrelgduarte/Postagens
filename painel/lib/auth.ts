export const DEFAULT_USER_ID = "default-user";

export function clerkEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );
}

export async function currentUserId(): Promise<string> {
  if (!clerkEnabled()) {
    return process.env.DEV_USER_ID || DEFAULT_USER_ID;
  }
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) throw new Error("Não autenticado");
  return userId;
}

// Sync variant for scripts/workers that don't go through Clerk.
export function workerUserId(): string {
  return process.env.WORKER_USER_ID || process.env.DEV_USER_ID || DEFAULT_USER_ID;
}

export async function getUserEmail(userId: string): Promise<string | null> {
  if (clerkEnabled() && userId !== DEFAULT_USER_ID && !userId.startsWith("dev-")) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const primary =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ??
        user.emailAddresses[0];
      return primary?.emailAddress ?? null;
    } catch {
      return process.env.NOTIFY_EMAIL ?? null;
    }
  }
  return process.env.NOTIFY_EMAIL ?? null;
}
