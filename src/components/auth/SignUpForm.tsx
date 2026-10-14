"use client";

import { useState } from "react";
import Link from "next/link";
import { PencilSimple } from "@phosphor-icons/react";
import { ChromeButton } from "@/components/ui/ChromeButton";
import { HandleField } from "@/components/ui/HandleField";
import { TickLoader } from "@/components/ui/TickLoader";
import {
  ConsentNote,
  useWaitlist,
  WaitlistHiddenFields,
} from "@/components/waitlist/useWaitlist";
import { authField } from "./AuthShell";

const IDS = { handle: "signup-handle", email: "signup-email", channel: "signup-channel" };

export function SignUpForm() {
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState("");
  const waitlist = useWaitlist(IDS);

  return (
    <>
      <h1 className="display text-[clamp(2.75rem,10vw,4rem)]">Sign-up opens soon</h1>
      <p className="mt-4 text-pretty text-lg text-muted">
        Join the waitlist and we&apos;ll email you when it opens. Add the
        handle you want too; handles aren&apos;t reserved until then.
      </p>
      <form
        action={waitlist.action}
        onSubmit={waitlist.onSubmit}
        noValidate
        className="mt-10 space-y-6"
      >
        <WaitlistHiddenFields source="signup" />
        <div>
          <label htmlFor={IDS.handle} className="mb-2 block text-sm font-medium text-muted">
            The handle you want (optional)
          </label>
          <HandleField
            id={IDS.handle}
            tone="dark"
            value={handle}
            onChange={(next) => {
              setHandle(next);
              waitlist.onEdit();
            }}
            invalid={waitlist.invalid("handle")}
            describedBy="signup-status"
            scanning={waitlist.pending}
          />
        </div>
        <div>
          <label htmlFor={IDS.email} className="mb-2 block text-sm font-medium text-muted">
            Email
          </label>
          <input
            id={IDS.email}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              waitlist.onEdit();
            }}
            aria-invalid={waitlist.invalid("email")}
            aria-describedby="signup-status"
            placeholder="you@example.com"
            className={authField}
          />
        </div>
        <div>
          <label htmlFor={IDS.channel} className="mb-2 block text-sm font-medium text-muted">
            YouTube channel (optional)
          </label>
          <input
            id={IDS.channel}
            type="url"
            name="channel"
            inputMode="url"
            autoComplete="url"
            maxLength={200}
            value={channel}
            onChange={(event) => {
              setChannel(event.target.value);
              waitlist.onEdit();
            }}
            aria-invalid={waitlist.invalid("channel")}
            aria-describedby="signup-status"
            placeholder="youtube.com/@yourchannel"
            className={authField}
          />
        </div>
        <ChromeButton
          type="submit"
          size="lg"
          icon={<PencilSimple weight="bold" size={18} />}
          className="w-full"
        >
          {/* Both labels share one cell, so nothing shifts while saving. */}
          <span className="grid">
            <span className={`col-start-1 row-start-1 ${waitlist.pending ? "invisible" : ""}`}>
              Join the waitlist
            </span>
            <span
              className={`col-start-1 row-start-1 inline-flex items-center gap-3 ${waitlist.pending ? "" : "invisible"}`}
            >
              {waitlist.pending && <TickLoader />}
              Joining
            </span>
          </span>
        </ChromeButton>
        <p id="signup-status" role="status" className="min-h-6 text-base font-medium">
          {waitlist.message}
        </p>
        <ConsentNote tone="dark" />
      </form>
      <p className="mt-8 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/signin" className="text-text underline decoration-line hover:decoration-accent">
          Sign in
        </Link>
      </p>
    </>
  );
}
