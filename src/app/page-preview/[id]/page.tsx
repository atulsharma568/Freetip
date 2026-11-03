import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCreator } from "@/app/[handle]/creator";
import { defaultDocFor, loadTipPageData } from "@/app/[handle]/tip-page-data";
import { isClosedGoogleId } from "@/lib/account-close";
import { requireOwner } from "@/lib/owner-auth";
import { loadDraft } from "@/lib/page-doc/store";
import type { Query } from "@/lib/accrual";
import { PreviewHost } from "./PreviewHost";

// The preview frame of the owner's tip page editor: the real tip page for creator <id>, drawn
// from their saved draft (then from whatever the editor sends). Owner only, never indexed, and
// allowed inside a frame of this same site only (see next.config.ts). Payments are off.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tip page preview", robots: { index: false, follow: false } };

export default async function PagePreview({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();
  const creatorId = Number(id);
  const db = getDb();
  if (!db) notFound();

  const [row] = await db<{ handle: string | null }[]>`select handle from users where id = ${creatorId}`;
  if (!row?.handle) notFound();
  const creator = await getCreator(row.handle);
  if (!creator || isClosedGoogleId(creator.google_id)) notFound();

  const state = await loadDraft(db as unknown as Query, creatorId, defaultDocFor(row.handle, creator));
  if (!state) notFound();
  const data = await loadTipPageData(row.handle, creator, { doc: state.doc, previewMode: true, editing: true });
  return <PreviewHost data={data} />;
}
