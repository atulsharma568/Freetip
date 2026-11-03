import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { discardOverlays, publishOverlays, saveOverlays, swapOverlays } from "@/app/actions/overlay-doc";
import { load } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import type { Query } from "@/lib/accrual";
import { OVERLAY_FONT_CLASSES } from "@/components/overlay/fonts";
import { requireOwner } from "@/lib/owner-auth";
import { loadOverlayState } from "@/lib/overlay-doc/store";
import { CouldNotRead, DatabaseNotSetUp } from "../../../_components/Notices";
import { PageHeader } from "../../../_components/PageHeader";
import { OverlayEditor } from "./OverlayEditor";

// The owner's editor for one creator's OBS overlays (the alert and the goal bar). Owner only; the
// creator has no editor here, and keeps the settings pages they already have.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit overlays: Owner console", robots: { index: false, follow: false } };

export default async function EditOverlaysPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  if (!/^\d{1,10}$/.test(id) || Number(id) > 2147483647) notFound(); // users.id is a 32-bit integer
  const creatorId = Number(id);
  const db = adminDb();
  if (!db) return <DatabaseNotSetUp />;

  const [row] = await db<{ handle: string | null; name: string | null; display_name: string | null; email: string; paid_features: string[] | null }[]>`
    select handle, name, display_name, email, paid_features from users where id = ${creatorId}
  `;
  if (!row) notFound();
  const name = row.display_name ?? row.name ?? row.email;
  const back = { href: `/admin/creators/${creatorId}`, label: name };

  const read = await load("the overlays", () => loadOverlayState(db as unknown as Query, creatorId));
  if (!read.ok) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Overlays" title={name} back={back} />
        <CouldNotRead message="Could not read the overlays. Run migration 0053 in Neon." detail={read.error} />
      </div>
    );
  }
  const state = read.data;
  if (!state) notFound();

  const blocked = !state.switchOn
    ? 'Switch on "Custom tip page" for this creator first, under Paid features on their page.'
    : !row.handle
      ? "This creator has no handle yet, so there is no overlay link to use."
      : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overlays"
        title={name}
        back={back}
        note="Change how this creator's donation alert and goal bar look on stream. Nothing reaches the stream until you press Publish, and you can swap back. Only you can do this here; the creator keeps their own settings pages. A part whose paid switch is off stays as it is."
      />
      {blocked ? (
        <p className="max-w-xl text-sm text-muted">
          {blocked}{" "}
          <Link href={back.href} className="underline hover:text-text">
            Back to {name}
          </Link>
        </p>
      ) : (
        <OverlayEditor
          start={{ doc: state.doc, base: state.base, live: state.live, source: state.source, hasPrevious: state.hasPrevious }}
          creatorName={name}
          features={row.paid_features ?? []}
          accent={state.accent}
          fontClasses={OVERLAY_FONT_CLASSES}
          save={saveOverlays.bind(null, creatorId)}
          publish={publishOverlays.bind(null, creatorId)}
          swap={swapOverlays.bind(null, creatorId)}
          discard={discardOverlays.bind(null, creatorId)}
        />
      )}
    </div>
  );
}
