import { SignIn } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/auth";
import { notFound } from "next/navigation";

export default function SignInPage() {
  if (!clerkEnabled()) notFound();
  return (
    <div className="flex justify-center py-10">
      <SignIn />
    </div>
  );
}
