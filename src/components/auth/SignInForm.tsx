"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { SignIn } from "@phosphor-icons/react";
import { ChromeButton } from "@/components/ui/ChromeButton";
import { EMAIL_PATTERN } from "@/lib/waitlist";
import { authField } from "./AuthShell";

type Status = "idle" | "email" | "closed";

const MESSAGES: Record<Status, string> = {
  idle: "",
  email: "Enter a valid email address.",
  closed: "Sign-in isn't open yet, so nothing was sent.",
};

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setStatus(EMAIL_PATTERN.test(email) ? "closed" : "email");
  };

  return (
    <>
      <h1 className="display text-[clamp(2.75rem,10vw,4rem)]">Welcome back</h1>
      <p className="mt-4 text-pretty text-lg text-muted">
        Sign-in opens together with sign-up. There are no accounts yet.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-10 space-y-6">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-muted">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setStatus("idle");
            }}
            aria-invalid={status === "email"}
            aria-describedby="signin-status"
            placeholder="you@example.com"
            className={authField}
          />
        </label>
        <ChromeButton type="submit" size="lg" icon={<SignIn weight="bold" size={18} />} className="w-full">
          Sign in
        </ChromeButton>
        <p id="signin-status" role="status" className="min-h-6 text-base font-medium">
          {MESSAGES[status]}
        </p>
      </form>
      <p className="text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="text-text underline decoration-line hover:decoration-accent">
          Sign up
        </Link>
      </p>
    </>
  );
}
