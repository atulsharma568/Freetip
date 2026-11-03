import type { LedgerDb, Query } from "../accrual";
import { hasFeature } from "../plans";
import { checkAssetAllowance, isPageAssetUrl, needsPoster, usedAssetIds, type AssetKind, type ResolvedAsset } from "./assets";
import { parsePageDoc } from "./parse";

// The database half of the tip page's pictures (migration 0052). No site imports, so the tests run
// it against an in-memory Postgres.
//
// Rules in one place:
//   - A file belongs to one creator. A page document can name only its own creator's files; any
//     other id, a removed file and a file whose address is not in our store under that creator's
//     folder give nothing, and the page draws its normal look.
//   - Adding a file re-checks the creator's "Custom tip page" switch and the allowance (files and
//     bytes) inside one transaction that locks the creator's row, so two uploads at once cannot
//     both slip under the limit.
//   - Removing a file is refused while the draft, the published page or the previous version still
//     uses it, and says which. The row stays as "removed" and the caller deletes the files. The
//     owner's take-down in /admin/media has no such refusal: the page just shows its normal look.
//   - Adding and removing each write one audit row against the creator.

export interface NewAsset {
  kind: AssetKind;
  name: string;
  blobUrl: string;
  posterUrl: string | null;
  mime: string;
  sizeBytes: number;
  posterBytes: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

// What the editor lists for one file.
export interface AssetListItem {
  id: number;
  kind: AssetKind;
  name: string;
  url: string;
  posterUrl: string | null;
  sizeBytes: number;
  durationMs: number | null;
  createdAt: string;
  // Where it is used now: "the draft", "the published page", "the previous version".
  usedBy: string[];
}

type Row = {
  id: string;
  kind: AssetKind;
  name: string;
  blob_url: string;
  poster_url: string | null;
  size_bytes: number;
  duration_ms: number | null;
  created_at: Date;
};

// A type alias, not an interface: the query helper only accepts rows that have an index signature.
type Docs = { page_draft: unknown; page_published: unknown; page_previous: unknown };

const DOC_LABELS: [keyof Docs, string][] = [
  ["page_draft", "the draft"],
  ["page_published", "the published page"],
  ["page_previous", "the previous version"],
];

// Which of a creator's stored documents point at the file.
export function usageOf(docs: Docs, assetId: number): string[] {
  return DOC_LABELS.filter(([column]) => {
    const parsed = parsePageDoc(docs[column]);
    return parsed !== null && usedAssetIds(parsed.doc).includes(assetId);
  }).map(([, label]) => label);
}

function resolved(creatorId: number, row: Pick<Row, "id" | "kind" | "blob_url" | "poster_url">): ResolvedAsset | null {
  if (!isPageAssetUrl(row.blob_url, creatorId)) return null;
  const poster = row.poster_url && isPageAssetUrl(row.poster_url, creatorId) ? row.poster_url : null;
  // An animated file without its still cannot be shown on a device that should not play motion.
  if (needsPoster(row.kind) && !poster) return null;
  return { id: Number(row.id), kind: row.kind, url: row.blob_url, posterUrl: poster };
}

// The files a page may draw: the creator's own live files, by id. Pass `ids` for the real page (only
// what its document uses) or nothing for the editor's preview (every live file, so a file just
// uploaded can be drawn). Throws when the table is missing; callers decide what that means.
export async function resolveAssets(db: Query, creatorId: number, ids?: readonly number[]): Promise<Record<number, ResolvedAsset>> {
  if (ids && ids.length === 0) return {};
  // A creator has at most ten live files, so they are all read and filtered here.
  const rows = await db<Row[]>`
    select id::text, kind, name, blob_url, poster_url, size_bytes, duration_ms, created_at
    from page_assets where creator_id = ${creatorId} and review_state = 'approved'
  `;
  const out: Record<number, ResolvedAsset> = {};
  for (const row of rows) {
    if (ids && !ids.includes(Number(row.id))) continue;
    const asset = resolved(creatorId, row);
    if (asset) out[asset.id] = asset;
  }
  return out;
}

// The same, for the tip page: a missing table (migration 0052 not run) is logged and gives nothing.
export async function loadPageAssets(db: Query, creatorId: number, ids: readonly number[]): Promise<Record<number, ResolvedAsset>> {
  try {
    return await resolveAssets(db, creatorId, ids);
  } catch (err) {
    console.error("Tip page: could not read the page pictures (migration 0052 run?).", err);
    return {};
  }
}

// The editor's library. Throws when the table is missing, so the page can say "run migration 0052".
export async function listAssets(db: Query, creatorId: number): Promise<AssetListItem[]> {
  const rows = await db<Row[]>`
    select id::text, kind, name, blob_url, poster_url, size_bytes, duration_ms, created_at
    from page_assets where creator_id = ${creatorId} and review_state = 'approved'
    order by created_at desc, id desc
  `;
  const [docs] = await db<Docs[]>`select page_draft, page_published, page_previous from users where id = ${creatorId}`;
  const items: AssetListItem[] = [];
  for (const row of rows) {
    const asset = resolved(creatorId, row);
    if (!asset) continue;
    items.push({
      id: asset.id,
      kind: asset.kind,
      name: row.name,
      url: asset.url,
      posterUrl: asset.posterUrl,
      sizeBytes: row.size_bytes,
      durationMs: row.duration_ms,
      createdAt: new Date(row.created_at).toISOString(),
      usedBy: docs ? usageOf(docs, asset.id) : [],
    });
  }
  return items;
}

// Which of these addresses a live row still points at, as file or still. A file
// nobody points at may be deleted; one a row points at never may (a retried upload must not delete
// the file of the first save).
export async function referencedUrls(db: Query, urls: readonly string[]): Promise<Set<string>> {
  const used = new Set<string>();
  // At most two addresses (the file and its still), so one small query each.
  for (const url of urls) {
    const rows = await db<{ one: number }[]>`
      select 1 as one from page_assets
      where review_state = 'approved' and (blob_url = ${url} or poster_url = ${url}) limit 1
    `;
    if (rows.length > 0) used.add(url);
  }
  return used;
}

export type AssetResult<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; message: string };

async function audit(tx: Query, action: string, creatorId: number, detail: Record<string, unknown>, reason: string) {
  await tx`
    insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
    values (null, 'owner', ${action}, 'user', ${String(creatorId)}, ${detail}::jsonb, ${reason})
  `;
}

// Saves a file the server has already checked (first bytes, size, poster). Returns its id.
export async function insertAsset(db: LedgerDb, creatorId: number, file: NewAsset): Promise<AssetResult<{ id: number }>> {
  return db.begin(async (tx): Promise<AssetResult<{ id: number }>> => {
    const [creator] = await tx<{ paid_features: string[] | null }[]>`select paid_features from users where id = ${creatorId} for update`;
    if (!creator) return { ok: false, message: "That creator was not found." };
    if (!hasFeature(creator, "pageBuilder")) return { ok: false, message: 'Switch on "Custom tip page" for this creator first.' };
    const [have] = await tx<{ files: number; bytes: string }[]>`
      select count(*)::int as files, coalesce(sum(size_bytes + coalesce(poster_bytes, 0)), 0)::text as bytes
      from page_assets where creator_id = ${creatorId} and review_state = 'approved'
    `;
    const full = checkAssetAllowance({ files: have.files, bytes: Number(have.bytes) }, file.sizeBytes + (file.posterBytes ?? 0));
    if (full) return { ok: false, message: full };
    const [row] = await tx<{ id: string }[]>`
      insert into page_assets
        (creator_id, kind, name, blob_url, poster_url, mime, size_bytes, poster_bytes, width, height, duration_ms)
      values
        (${creatorId}, ${file.kind}, ${file.name}, ${file.blobUrl}, ${file.posterUrl}, ${file.mime}, ${file.sizeBytes},
         ${file.posterBytes}, ${file.width}, ${file.height}, ${file.durationMs})
      returning id::text
    `;
    await audit(tx, "creator.page_asset_added", creatorId, { asset_id: Number(row.id), kind: file.kind, name: file.name }, "uploaded by the owner");
    return { ok: true, id: Number(row.id) };
  });
}

// Removes a file the creator's pages no longer use. The caller deletes the returned addresses.
export async function removeAsset(db: LedgerDb, creatorId: number, assetId: number): Promise<AssetResult<{ urls: string[] }>> {
  return db.begin(async (tx): Promise<AssetResult<{ urls: string[] }>> => {
    const [docs] = await tx<Docs[]>`select page_draft, page_published, page_previous from users where id = ${creatorId} for update`;
    if (!docs) return { ok: false, message: "That creator was not found." };
    const [row] = await tx<{ name: string; blob_url: string; poster_url: string | null }[]>`
      select name, blob_url, poster_url from page_assets
      where id = ${assetId} and creator_id = ${creatorId} and review_state = 'approved' for update
    `;
    if (!row) return { ok: false, message: "That file is already gone." };
    const used = usageOf(docs, assetId);
    if (used.length > 0) {
      return { ok: false, message: `"${row.name}" is still used by ${used.join(" and ")}. Point those at another file (or take the picture off) first.` };
    }
    await tx`update page_assets set review_state = 'removed', removed_at = now() where id = ${assetId}`;
    await audit(tx, "creator.page_asset_removed", creatorId, { asset_id: assetId, name: row.name }, "removed by the owner");
    return { ok: true, urls: [row.blob_url, ...(row.poster_url ? [row.poster_url] : [])] };
  });
}

// The owner's take-down from /admin/media: allowed even while a page uses the file (the page then
// shows its normal look in its place).
export async function takeDownAsset(db: LedgerDb, assetId: number, reason: string): Promise<AssetResult<{ urls: string[]; creatorId: number }>> {
  return db.begin(async (tx): Promise<AssetResult<{ urls: string[]; creatorId: number }>> => {
    const [row] = await tx<{ creator_id: string; name: string; blob_url: string; poster_url: string | null }[]>`
      update page_assets set review_state = 'removed', removed_at = now()
      where id = ${assetId} and review_state = 'approved'
      returning creator_id::text, name, blob_url, poster_url
    `;
    if (!row) return { ok: false, message: "That file is already taken down." };
    const creatorId = Number(row.creator_id);
    await audit(tx, "creator.page_asset_taken_down", creatorId, { asset_id: assetId, name: row.name }, reason);
    return { ok: true, creatorId, urls: [row.blob_url, ...(row.poster_url ? [row.poster_url] : [])] };
  });
}
