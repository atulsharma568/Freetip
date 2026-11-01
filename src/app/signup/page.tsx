import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Sign up: ${SITE_NAME}`,
  description: `Create your ${SITE_NAME} account with Google and start receiving tips on your YouTube stream.`,
  robots: { index: false },
};

export default async function SignUpPage() {
  // Already signed in: go straight to the dashboard instead of offering Google again.
  if ((await auth())?.user) redirect("/dashboard");
  return (
    <AuthShell>
      <SignUpForm />
    </AuthShell>
  );
}
