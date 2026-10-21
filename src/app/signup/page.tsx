import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Get early access: ${SITE_NAME}`,
  description: `Sign up for early access to ${SITE_NAME}. Limited spots — connect your Google and YouTube account to reserve yours.`,
  robots: { index: false },
};

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUpForm />
    </AuthShell>
  );
}
