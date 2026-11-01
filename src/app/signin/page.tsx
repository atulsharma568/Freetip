import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Sign in: ${SITE_NAME}`,
  description: `Sign in to your ${SITE_NAME} creator account.`,
  robots: { index: false },
};

export default async function SignInPage() {
  // Already signed in: go straight to the dashboard instead of offering Google again.
  if ((await auth())?.user) redirect("/dashboard");
  return (
    <AuthShell>
      <SignInForm />
    </AuthShell>
  );
}
