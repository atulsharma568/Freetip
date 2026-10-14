"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { PencilSimple } from "@phosphor-icons/react";
import { ChromeButton } from "@/components/ui/ChromeButton";
import { HANDLE_PATTERN, HandleField } from "@/components/ui/HandleField";
import { authField, EMAIL_PATTERN } from "./AuthShell";

type Status = "idle" | "handle" | "email" | "closed";

const MESSAGES: Record<Status, string> = {
  idle: "",
  handle: "Check your handle: 3 to 20 letters, numbers or underscores.",
  email: "Enter a valid email address.",
  closed: "Sign-up isn't open yet, so nothing was saved.",
};

export function SignUpForm() {
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [scanning, setScanning] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next: Status = !HANDLE_PATTERN.test(handle)
      ? "handle"
      : !EMAIL_PATTERN.test(email)
        ? "email"
        : "closed";
    if (next !== "closed" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStatus(next);
      return;
    }
    setStatus("idle");
    setScanning(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setScanning(false);
      setStatus(next);
    }, 700);
  };

  return (
    <>
      <h1 className="display text-[clamp(2.75rem,10vw,4rem)]">Create your page</h1>
      <p className="mt-4 text-pretty text-lg text-muted">
        Sign-up isn&apos;t open yet. You can try the form, but nothing you enter
        is saved.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-10 space-y-6">
        <div>
          <label htmlFor="signup-handle" className="mb-2 block text-sm font-medium text-muted">
            Your handle
          </label>
          <HandleField
            id="signup-handle"
            tone="dark"
            value={handle}
            onChange={(next) => {
              setHandle(next);
              setStatus("idle");
            }}
            invalid={status === "handle"}
            describedBy="signup-status"
            scanning={scanning}
          />
        </div>
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
            aria-describedby="signup-status"
            placeholder="you@example.com"
            className={authField}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-muted">
            YouTube channel (optional)
          </span>
          <input
            type="url"
            name="channel"
            inputMode="url"
            autoComplete="url"
            placeholder="youtube.com/@yourchannel"
            className={authField}
          />
        </label>
        <ChromeButton type="submit" size="lg" icon={<PencilSimple weight="bold" size={18} />} className="w-full">
          Sign up
        </ChromeButton>
        <p id="signup-status" role="status" className="min-h-6 text-base font-medium">
          {MESSAGES[status]}
        </p>
      </form>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/signin" className="text-text underline decoration-line hover:decoration-accent">
          Sign in
        </Link>
      </p>
    </>
  );
}
