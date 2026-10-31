import Link from "next/link";
import { OPERATOR, PLACEHOLDER, type OperatorKey } from "@/lib/legal";

// An operator detail from lib/legal.ts, or a visible [placeholder] until it
// is filled in.
export function Fill({ k }: { k: OperatorKey }) {
  const value = OPERATOR[k];
  if (value) return <>{value}</>;
  return (
    <span className="rounded bg-accent/15 px-1 font-medium text-accent">
      [{PLACEHOLDER[k]}]
    </span>
  );
}

// A mailto link for an operator email. With no email set (the owner uses the
// contact form instead, 2026-10-31) it links to the contact form.
export function MailFill({ k }: { k: "supportEmail" | "grievanceEmail" }) {
  const value = OPERATOR[k];
  return value ? <a href={`mailto:${value}`}>{value}</a> : <Link href="/contact">contact form</Link>;
}
