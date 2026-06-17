import { SignUp } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/auth";
import { notFound } from "next/navigation";

export default function SignUpPage() {
  if (!clerkEnabled()) notFound();
  return (
    <div className="flex justify-center py-10">
      <SignUp />
    </div>
  );
}
