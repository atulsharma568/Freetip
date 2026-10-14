import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Sign up: ${SITE_NAME}`,
  description: `Create your ${SITE_NAME} tip page. Sign-up isn't open yet.`,
};

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUpForm />
    </AuthShell>
  );
}
