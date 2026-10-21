import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Sign in: ${SITE_NAME}`,
  description: `Sign in to your ${SITE_NAME} creator account.`,
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <AuthShell>
      <SignInForm />
    </AuthShell>
  );
}
