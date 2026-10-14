import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Sign in: ${SITE_NAME}`,
  description: `Sign in to ${SITE_NAME}. Accounts aren't open yet.`,
};

export default function SignInPage() {
  return (
    <AuthShell>
      <SignInForm />
    </AuthShell>
  );
}
