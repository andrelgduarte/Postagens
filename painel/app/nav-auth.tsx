"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export function NavAuth() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <div className="w-7 h-7" />;
  if (isSignedIn) return <UserButton />;
  return (
    <SignInButton mode="modal">
      <button className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
        Entrar
      </button>
    </SignInButton>
  );
}
