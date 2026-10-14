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

// A mailto link for an operator email, or its placeholder.
export function MailFill({ k }: { k: "supportEmail" | "grievanceEmail" }) {
  const value = OPERATOR[k];
  return value ? <a href={`mailto:${value}`}>{value}</a> : <Fill k={k} />;
}
