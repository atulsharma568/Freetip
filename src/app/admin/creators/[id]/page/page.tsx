import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultDocFor } from "@/app/[handle]/tip-page-data";
import { savePageDraft, publishPage, discardPageDraft } from "@/app/actions/page-doc";
import { load } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import type { Query } from "@/lib/accrual";
import { requireOwner } from "@/lib/owner-auth";
import { loadDraft } from "@/lib/page-doc/store";
import { CouldNotRead, DatabaseNotSetUp } from "../../../_components/Notices";
import { PageHeader } from "../../../_components/PageHeader";
import { PageEditor } from "./PageEditor";

// The owner's editor for one creator's tip page. Owner only; the creator has no editor.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit tip page: Owner console", robots: { index: false, follow: false } };

export default async function EditTipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  if (!/^\d{1,10}$/.test(id) || Number(id) > 2147483647) notFound(); // users.id is a 32-bit integer
  const creatorId = Number(id);
  const db = adminDb();
  if (!db) return <DatabaseNotSetUp />;

  const [row] = await db<{ handle: string | null; google_id: string; name: string | null; display_name: string | null; email: string }[]>`
    select handle, google_id, name, display_name, email from users where id = ${creatorId}
  `;
  if (!row) notFound();
  const name = row.display_name ?? row.name ?? row.email;
  const back = { href: `/admin/creators/${creatorId}`, label: name };
  const fallback = defaultDocFor(row.handle ?? "", row);

  const read = await load("the tip page", () => loadDraft(db as unknown as Query, creatorId, fallback));
  if (!read.ok) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Tip page" title={name} back={back} />
        <CouldNotRead message="Could not read the tip page. Run migration 0051 in Neon." detail={read.error} />
      </div>
    );
  }
  const state = read.data;
  if (!state) notFound();

  const blocked = !state.switchOn
    ? 'Switch on "Custom tip page" for this creator first, under Paid features on their page.'
    : !row.handle
      ? "This creator has no handle yet, so there is no tip page to preview."
      : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tip page"
        title={name}
        back={back}
        note="Change the words, order and colours of this creator's tip page. Nothing reaches fans until you press Publish. Only you can do this; the creator cannot edit their page."
      />
      {blocked ? (
        <p className="max-w-xl text-sm text-muted">
          {blocked}{" "}
          <Link href={back.href} className="underline hover:text-text">
            Back to {name}
          </Link>
        </p>
      ) : (
        <PageEditor
          start={{ doc: state.doc, base: state.base, published: state.published, source: state.source, fallback }}
          previewSrc={`/page-preview/${creatorId}`}
          creatorName={name}
          save={savePageDraft.bind(null, creatorId)}
          publish={publishPage.bind(null, creatorId)}
          discard={discardPageDraft.bind(null, creatorId)}
        />
      )}
    </div>
  );
}
