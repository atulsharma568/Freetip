import type { LedgerDb, Query } from "./accrual";
import { safeBannerUrl } from "./tip-banner";
import { parsePlacement, safeDecorUrl, type DecorPlacement, type DecorUpload, type DecorUploadKind, type TipDecor } from "./page-doc/decor";

// The database half of the decoration library (migration 0062). No site imports, so the tests run it
// against an in-memory Postgres.
//
// Rules in one place:
//   - An item belongs to the creator who uploaded it. A creator can wear their own approved items and
//     the approved items the owner granted them (an active grant); nothing else.
//   - "Removed" (by the creator, or taken down by the owner) stops the item showing everywhere at once,
//     on every page that wears it. Its files are erased by the caller.
//   - A grant is withdrawn by setting revoked_at; the picture then stops showing on that creator's page.
//   - The owner's grant, withdrawal and take-down each write an audit row in the same transaction.

// What a library item is: a profile picture, a decoration over it, or a tip page banner (migration 0063).
export type LibraryKind = DecorUploadKind | "banner";

export interface NewDecorItem {
  kind: LibraryKind;
  name: string;
  blobUrl: string;
  posterUrl: string | null;
  mime: string;
  sizeBytes: number;
  width: number;
  height: number;
  animated: boolean;
  placement: DecorPlacement;
}

// What the dashboard and the admin list for one item.
export interface DecorItem<K extends LibraryKind = DecorUploadKind> {
  id: number;
  creatorId: number;
  kind: K;
  name: string;
  url: string;
  posterUrl: string | null;
  mime: string;
  sizeBytes: number;
  width: number;
  height: number;
  animated: boolean;
  placement: DecorPlacement;
  createdAt: string;
  // Only set by the lists that join the owner's handle.
  ownerHandle: string | null;
}

type Row = {
  id: string;
  creator_id: string;
  kind: LibraryKind;
  name: string;
  blob_url: string;
  poster_url: string | null;
  mime: string;
  size_bytes: number;
  width: number;
  height: number;
  animated: boolean;
  placement: unknown;
  created_at: Date;
  handle?: string | null;
};

const toItem = <K extends LibraryKind = DecorUploadKind>(r: Row): DecorItem<K> => ({
  id: Number(r.id),
  creatorId: Number(r.creator_id),
  kind: r.kind as K,
  name: r.name,
  url: (r.kind === "banner" ? safeBannerUrl(r.blob_url) : safeDecorUrl(r.blob_url)) ?? "",
  posterUrl: safeDecorUrl(r.poster_url),
  mime: r.mime,
  sizeBytes: r.size_bytes,
  width: r.width,
  height: r.height,
  animated: r.animated,
  placement: parsePlacement(r.placement),
  createdAt: new Date(r.created_at).toISOString(),
  ownerHandle: r.handle ?? null,
});

// The name shown in the lists: the file's own name without its extension, kept short.
const CONTROL = /[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060\ufeff<>]/g;
export const cleanItemName = (raw: unknown): string => {
  const s = String(raw ?? "").replace(CONTROL, "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/\s+/g, " ").trim().slice(0, 40);
  return s || "Picture";
};

async function audit(tx: Query, action: string, itemId: number, detail: Record<string, unknown>, reason: string | null) {
  await tx`
    insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, after_json, reason)
    values (null, 'owner', ${action}, 'decor_item', ${String(itemId)}, ${detail}::jsonb, ${reason})
  `;
}

// Saves a picture the server has already checked. Returns the new item's id.
export async function createDecorItem(db: Query, creatorId: number, item: NewDecorItem): Promise<number> {
  const [row] = await db<{ id: string }[]>`
    insert into decor_items (creator_id, kind, name, blob_url, poster_url, mime, size_bytes, width, height, animated, placement)
    values (${creatorId}, ${item.kind}, ${cleanItemName(item.name)}, ${item.blobUrl}, ${item.posterUrl}, ${item.mime}, ${item.sizeBytes},
            ${item.width}, ${item.height}, ${item.animated}, ${item.placement}::jsonb)
    returning id::text as id
  `;
  return Number(row.id);
}

// What a creator can pick from: their own approved items and the approved items granted to them.
export async function listCreatorDecor(db: Query, creatorId: number): Promise<{ mine: DecorItem[]; shared: DecorItem[] }> {
  const mine = await db<Row[]>`
    select i.id::text as id, i.creator_id::text as creator_id, i.kind, i.name, i.blob_url, i.poster_url, i.mime, i.size_bytes, i.width, i.height, i.animated, i.placement, i.created_at
    from decor_items i
    where i.creator_id = ${creatorId} and i.review_state = 'approved' and i.kind in ('avatar', 'frame')
    order by i.created_at desc, i.id desc
  `;
  const shared = await db<Row[]>`
    select i.id::text as id, i.creator_id::text as creator_id, i.kind, i.name, i.blob_url, i.poster_url, i.mime, i.size_bytes, i.width, i.height, i.animated, i.placement, i.created_at, u.handle
    from decor_grants g
    join decor_items i on i.id = g.item_id
    join users u on u.id = i.creator_id
    where g.to_creator_id = ${creatorId} and g.revoked_at is null and i.review_state = 'approved' and i.creator_id <> ${creatorId} and i.kind in ('avatar', 'frame')
    order by g.granted_at desc, i.id desc
  `;
  return { mine: mine.map(toItem), shared: shared.map(toItem) };
}

// One item this creator may wear now, or null: it must be approved and either theirs or actively granted.
export async function usableItem(db: Query, creatorId: number, itemId: number): Promise<DecorItem | null> {
  const [row] = await db<Row[]>`
    select i.id::text as id, i.creator_id::text as creator_id, i.kind, i.name, i.blob_url, i.poster_url, i.mime, i.size_bytes, i.width, i.height, i.animated, i.placement, i.created_at
    from decor_items i
    where i.id = ${itemId} and i.review_state = 'approved' and i.kind in ('avatar', 'frame')
      and (i.creator_id = ${creatorId}
           or exists (select 1 from decor_grants g where g.item_id = i.id and g.to_creator_id = ${creatorId} and g.revoked_at is null))
  `;
  return row ? toItem(row) : null;
}

// The worn pictures of a saved pick with the ones that may no longer show taken out: a picture that
// names a library item is kept only while that item is usable by this creator (not removed, not a
// withdrawn grant). A picture saved before the library existed names no item and is kept as it is.
export async function resolveWornItems(db: Query, creatorId: number, decor: TipDecor): Promise<TipDecor> {
  const keep = async (up: DecorUpload | null): Promise<DecorUpload | null> => {
    if (!up || up.itemId === null) return up;
    return (await usableItem(db, creatorId, up.itemId)) ? up : null;
  };
  const [avatarUpload, frameUpload] = [await keep(decor.avatarUpload), await keep(decor.frameUpload)];
  return avatarUpload === decor.avatarUpload && frameUpload === decor.frameUpload ? decor : { ...decor, avatarUpload, frameUpload };
}

// The creator's own item: a new name or a remembered placement. False when it is not theirs.
export async function updateOwnItem(db: Query, creatorId: number, itemId: number, patch: { name?: string; placement?: DecorPlacement }): Promise<boolean> {
  const rows = await db<{ id: string }[]>`
    update decor_items
       set name = coalesce(${patch.name === undefined ? null : cleanItemName(patch.name)}, name),
           placement = coalesce(${patch.placement ?? null}::jsonb, placement)
     where id = ${itemId} and creator_id = ${creatorId} and review_state = 'approved'
     returning id::text as id
  `;
  return rows.length > 0;
}

export type RemoveResult = { ok: true; urls: string[] } | { ok: false; message: string };

async function markRemoved(tx: Query, itemId: number, creatorId: number | null): Promise<RemoveResult & { creator?: number }> {
  const [row] = await tx<{ creator_id: string; blob_url: string; poster_url: string | null; review_state: string }[]>`
    select creator_id::text as creator_id, blob_url, poster_url, review_state from decor_items
    where id = ${itemId} for update
  `;
  if (!row || (creatorId !== null && Number(row.creator_id) !== creatorId)) return { ok: false, message: "That picture was not found." };
  if (row.review_state === "removed") return { ok: false, message: "That picture is already removed." };
  await tx`update decor_items set review_state = 'removed', removed_at = now() where id = ${itemId}`;
  await tx`update decor_grants set revoked_at = now() where item_id = ${itemId} and revoked_at is null`;
  return { ok: true, urls: [row.blob_url, ...(row.poster_url ? [row.poster_url] : [])], creator: Number(row.creator_id) };
}

// The creator deletes one of their own items: it stops showing on every page (theirs and any it was
// granted to) and its files can be erased. The caller erases `urls`.
export async function removeOwnItem(db: LedgerDb, creatorId: number, itemId: number): Promise<RemoveResult> {
  return db.begin(async (tx) => {
    const res = await markRemoved(tx, itemId, creatorId);
    if (!res.ok) return res;
    return { ok: true, urls: res.urls };
  });
}

// ---- The owner's side ----

export interface AdminDecorRow extends Omit<DecorItem, "kind"> {
  kind: LibraryKind;
  reviewState: "approved" | "removed";
  ownerName: string | null;
  grants: { creatorId: number; handle: string | null }[];
  wornBy: number;
}

// Every item, newest first, with who owns it, who it is granted to and how many pages wear it now.
export async function listAllDecor(db: Query): Promise<AdminDecorRow[]> {
  const items = await db<(Row & { review_state: "approved" | "removed"; name_owner: string | null; worn: string })[]>`
    select i.id::text as id, i.creator_id::text as creator_id, i.kind, i.name, i.blob_url, i.poster_url, i.mime, i.size_bytes, i.width, i.height, i.animated, i.placement, i.created_at,
           i.review_state, u.handle, u.name as name_owner,
           (select count(*) from users w
             where (w.tip_decor -> 'avatarUpload' ->> 'itemId') = i.id::text or (w.tip_decor -> 'frameUpload' ->> 'itemId') = i.id::text
                or (i.kind = 'banner' and w.tip_banner_url = i.blob_url))::text as worn
    from decor_items i join users u on u.id = i.creator_id
    order by i.created_at desc, i.id desc
    limit 500
  `;
  const grants = await db<{ item_id: string; to_creator_id: string; handle: string | null }[]>`
    select g.item_id::text as item_id, g.to_creator_id::text as to_creator_id, u.handle
    from decor_grants g join users u on u.id = g.to_creator_id where g.revoked_at is null
  `;
  return items.map((r) => ({
    ...toItem(r),
    reviewState: r.review_state,
    ownerName: r.name_owner,
    grants: grants.filter((g) => g.item_id === r.id).map((g) => ({ creatorId: Number(g.to_creator_id), handle: g.handle })),
    wornBy: Number(r.worn),
  }));
}

export type GrantResult = { ok: true; granted: number } | { ok: false; message: string };

// The owner lets other creators use one picture. Only an approved item can be granted, never to its own
// owner, and a creator who already has it (or had it withdrawn) simply gets it (again).
export async function grantDecor(db: LedgerDb, itemId: number, creatorIds: number[], reason: string | null): Promise<GrantResult> {
  const ids = [...new Set(creatorIds)].filter((n) => Number.isSafeInteger(n) && n >= 1);
  if (ids.length === 0) return { ok: false, message: "Choose at least one creator." };
  return db.begin(async (tx) => {
    const [item] = await tx<{ creator_id: string; review_state: string }[]>`select creator_id::text as creator_id, review_state from decor_items where id = ${itemId} for update`;
    if (!item) return { ok: false, message: "That picture was not found." } as const;
    if (item.review_state !== "approved") return { ok: false, message: "That picture is removed and cannot be shared." } as const;
    const targets = await tx<{ id: string }[]>`select id::text as id from users where id = any(${ids}::bigint[]) and id <> ${Number(item.creator_id)} and handle is not null`;
    if (targets.length === 0) return { ok: false, message: "None of those creators can be given this picture." } as const;
    for (const t of targets) {
      await tx`
        insert into decor_grants (item_id, to_creator_id) values (${itemId}, ${Number(t.id)})
        on conflict (item_id, to_creator_id) do update set revoked_at = null, granted_at = now()
      `;
    }
    await audit(tx, "decor.granted", itemId, { to: targets.map((t) => Number(t.id)) }, reason);
    return { ok: true, granted: targets.length } as const;
  });
}

// Withdraws one creator's use of a picture. False when there was no such running grant.
export async function revokeDecor(db: LedgerDb, itemId: number, creatorId: number, reason: string | null): Promise<boolean> {
  return db.begin(async (tx) => {
    const rows = await tx<{ item_id: string }[]>`
      update decor_grants set revoked_at = now() where item_id = ${itemId} and to_creator_id = ${creatorId} and revoked_at is null returning item_id::text as item_id
    `;
    if (rows.length === 0) return false;
    await audit(tx, "decor.revoked", itemId, { from: creatorId }, reason);
    return true;
  });
}

// The owner takes a picture down: it stops showing on every page at once and every grant ends. The
// caller erases `urls`.
export async function takeDownDecor(db: LedgerDb, itemId: number, reason: string | null): Promise<RemoveResult> {
  return db.begin(async (tx) => {
    const res = await markRemoved(tx, itemId, null);
    if (!res.ok) return res;
    await audit(tx, "decor.taken_down", itemId, { owner: res.creator ?? null }, reason);
    return { ok: true, urls: res.urls };
  });
}

// What one creator has: their own items and those granted to them (for the creator page in /admin).
export async function decorOfCreator(db: Query, creatorId: number): Promise<{ mine: DecorItem[]; shared: DecorItem[] }> {
  return listCreatorDecor(db, creatorId);
}

// ---- Banners (migration 0063) ----
// The worn banner is users.tip_banner_url. A banner that names a library item is shown only while that
// item may still be used by this creator; a banner that names none (a YouTube copy, or one uploaded before
// the library existed) is shown as it is.
export async function bannerStillUsable(db: Query, creatorId: number, url: string): Promise<boolean> {
  const rows = await db<{ ok: boolean }[]>`
    select (i.review_state = 'approved'
            and (i.creator_id = ${creatorId}
                 or exists (select 1 from decor_grants g where g.item_id = i.id and g.to_creator_id = ${creatorId} and g.revoked_at is null))) as ok
    from decor_items i where i.kind = 'banner' and i.blob_url = ${url}
  `;
  return rows.length === 0 || rows.some((r) => r.ok);
}

// Whether a file address belongs to a library item that is still approved (so it must not be erased
// just because one page stopped wearing it).
export async function isLibraryFile(db: Query, url: string): Promise<boolean> {
  const rows = await db<{ id: string }[]>`select id::text as id from decor_items where blob_url = ${url} and review_state = 'approved' limit 1`;
  return rows.length > 0;
}

// A creator's own and shared banners, for the banner page.
export async function listCreatorBanners(db: Query, creatorId: number): Promise<{ mine: DecorItem<"banner">[]; shared: DecorItem<"banner">[] }> {
  const mine = await db<Row[]>`
    select i.id::text as id, i.creator_id::text as creator_id, i.kind, i.name, i.blob_url, i.poster_url, i.mime, i.size_bytes, i.width, i.height, i.animated, i.placement, i.created_at
    from decor_items i
    where i.creator_id = ${creatorId} and i.review_state = 'approved' and i.kind = 'banner'
    order by i.created_at desc, i.id desc
  `;
  const shared = await db<Row[]>`
    select i.id::text as id, i.creator_id::text as creator_id, i.kind, i.name, i.blob_url, i.poster_url, i.mime, i.size_bytes, i.width, i.height, i.animated, i.placement, i.created_at, u.handle
    from decor_grants g
    join decor_items i on i.id = g.item_id
    join users u on u.id = i.creator_id
    where g.to_creator_id = ${creatorId} and g.revoked_at is null and i.review_state = 'approved' and i.creator_id <> ${creatorId} and i.kind = 'banner'
    order by g.granted_at desc, i.id desc
  `;
  return { mine: mine.map((r) => toItem<"banner">(r)), shared: shared.map((r) => toItem<"banner">(r)) };
}

// One banner this creator may wear now, or null.
export async function usableBanner(db: Query, creatorId: number, itemId: number): Promise<DecorItem<"banner"> | null> {
  const [row] = await db<Row[]>`
    select i.id::text as id, i.creator_id::text as creator_id, i.kind, i.name, i.blob_url, i.poster_url, i.mime, i.size_bytes, i.width, i.height, i.animated, i.placement, i.created_at
    from decor_items i
    where i.id = ${itemId} and i.kind = 'banner' and i.review_state = 'approved'
      and (i.creator_id = ${creatorId}
           or exists (select 1 from decor_grants g where g.item_id = i.id and g.to_creator_id = ${creatorId} and g.revoked_at is null))
  `;
  return row ? toItem<"banner">(row) : null;
}
