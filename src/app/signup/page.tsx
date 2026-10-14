import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Sign up: ${SITE_NAME}`,
  description: `Join the ${SITE_NAME} waitlist and hear when sign-up opens.`,
};

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUpForm />
    </AuthShell>
  );
}
