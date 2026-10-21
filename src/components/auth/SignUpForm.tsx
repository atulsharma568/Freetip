"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export function SignUpForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="display text-[clamp(2.75rem,10vw,4rem)]">Get early access</h1>
      <p className="mt-4 text-pretty text-lg text-muted">
        Limited spots. Sign up with Google and we&apos;ll connect your YouTube
        channel automatically.
      </p>

      <div className="mt-10 space-y-4">
        <GoogleButton onClick={handleGoogle} busy={busy}>
          {busy ? "Redirecting…" : "Continue with Google"}
        </GoogleButton>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-400">
            {error}
          </p>
        )}

        <p className="text-center text-sm text-muted">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="text-text underline decoration-line hover:decoration-accent">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-text underline decoration-line hover:decoration-accent">
            privacy policy
          </Link>
          .
        </p>
      </div>

      <p className="mt-8 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/signin" className="text-text underline decoration-line hover:decoration-accent">
          Sign in
        </Link>
      </p>
    </>
  );
}

function GoogleButton({
  onClick,
  busy,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex h-14 w-full items-center justify-center gap-3 rounded-full border-2 border-control bg-ground px-6 text-base font-medium text-text transition-[border-color,box-shadow,background-color,opacity] duration-200 ease-out-expo hover:border-muted hover:bg-surface focus-visible:border-accent focus-visible:shadow-[0_0_0_4px_rgb(191_232_74/0.14),0_0_28px_-4px_rgb(191_232_74/0.35)] focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {!busy && <GoogleLogo />}
      {children}
    </button>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
