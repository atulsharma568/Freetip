import { getDb } from "@/lib/db";
import { requireAdminViewer } from "@/lib/owner-auth";
import { getNotifyEmail, getSavedNotifyEmail, getTtsFloorPaise } from "@/lib/site-settings";
import { PageHeader } from "../_components/PageHeader";
import { NotifyEmailForm } from "./NotifyEmailForm";
import { TtsFloorForm } from "./TtsFloorForm";

export const dynamic = "force-dynamic";

// Settings that apply to the whole site, not to one creator.
export default async function AdminSettingsPage() {
  const viewer = (await requireAdminViewer()) === "viewer";
  const db = getDb();
  const floor = await getTtsFloorPaise(db);
  const saved = viewer ? null : await getSavedNotifyEmail(db);
  const inUse = viewer ? null : await getNotifyEmail(db);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System"
        title="Site settings"
        note="Rules and addresses for the whole site, not for one creator."
      />
      <section className="space-y-3" aria-labelledby="voice-heading">
        <h2 id="voice-heading" className="text-base font-semibold text-text">
          Voice (text-to-speech) minimum
        </h2>
        <p className="max-w-prose text-sm text-muted">
          A tip below this amount is never read aloud, whatever the creator chose, and the tip page does not offer the voice
          for it. It starts at ₹50. Use 0 for no site-wide minimum.
        </p>
        {viewer ? <p className="text-sm text-text">Currently ₹{Math.round(floor / 100)} (the owner changes this).</p> : <TtsFloorForm rupees={Math.round(floor / 100)} />}
      </section>
      {!viewer && (
        <section className="space-y-3" aria-labelledby="email-heading">
          <h2 id="email-heading" className="text-base font-semibold text-text">
            Where your emails go
          </h2>
          <p className="max-w-prose text-sm text-muted">
            The address that gets the contact-form messages and the morning list of creators to pay (every creator with ₹500
            or more available). Leave it empty to use the address set in Vercel (CONTACT_NOTIFY_EMAIL).
          </p>
          <p className="text-sm text-text">
            {inUse
              ? `Emails go to ${inUse}${saved ? "." : " (the address set in Vercel)."}`
              : "No address is set, so these emails are off. The messages and payouts still wait in the admin."}
          </p>
          <NotifyEmailForm email={saved ?? ""} />
          <p className="max-w-prose text-xs text-muted">
            Until a sending address on a domain verified in Resend is set (CONTACT_FROM_EMAIL), Resend only delivers to the
            email of your own Resend account, so use that address or verify a domain there first.
          </p>
        </section>
      )}
    </div>
  );
}
