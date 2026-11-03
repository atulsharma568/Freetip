"use server";

import { revalidatePath } from "next/cache";
import type { LedgerDb } from "@/lib/accrual";
import { BULK_MAX, saveCreatorRates, saveSiteRates } from "@/lib/fee-admin";
import { describeRates, parseRates } from "@/lib/fee-rates";
import { getDb } from "@/lib/db";
import { requireOwner } from "@/lib/owner-auth";
import type { AdminActionState } from "@/lib/admin/action-state";

// The owner's fee screens: the site-wide rates, one creator's own rates and the bulk "apply to the
// ticked creators". Only the owner can reach them; the saving itself (and its audit rows) is in
// `lib/fee-admin.ts`. Nothing here touches a tip that was already made.
const ok = (message: string): AdminActionState => ({ status: "ok", message });
const fail = (message: string): AdminActionState => ({ status: "error", message });
const NO_DB = "The database is not set up.";
const NOT_MIGRATED = "Could not save. Has migration 0054 been run in Neon?";

const reasonOf = (formData: FormData): string | null => {
  const r = formData.get("reason");
  return typeof r === "string" && r.trim() ? r.trim().slice(0, 300) : null;
};

const isUndefinedColumn = (err: unknown) => (err as { code?: string })?.code === "42703";

function refresh(creatorIds: number[] = []) {
  revalidatePath("/admin/fees");
  revalidatePath("/admin/creators");
  for (const id of creatorIds.slice(0, 50)) revalidatePath(`/admin/creators/${id}`);
  revalidatePath("/admin/audit");
  revalidatePath("/dashboard", "layout");
}

// The rates every creator follows unless they have their own pair.
export async function setSiteFeeRates(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireOwner();
  const parsed = parseRates(formData.get("platform"), formData.get("processing"));
  if (!parsed.ok) return fail(parsed.error);
  const db = getDb();
  if (!db) return fail(NO_DB);
  try {
    // The tips table must have the columns that remember each tip's rate before any rate moves.
    await db`select platform_bps, processing_bps from tip_orders limit 0`;
    const r = await saveSiteRates(db as unknown as LedgerDb, parsed.rates, reasonOf(formData));
    refresh();
    if (!r.changed) return ok(`Nothing changed: the site rates are already ${describeRates(r.after)}.`);
    return ok(
      `Saved. Creators on the site rates now pay ${describeRates(r.after)} on tips made from now on (${r.following} follow${r.following === 1 ? "s" : ""} them). Earlier tips keep their rate.`,
    );
  } catch (err) {
    console.error("Admin: could not save the site fee rates", err);
    return fail(isUndefinedColumn(err) ? NOT_MIGRATED : "Could not save. The server log has the reason.");
  }
}

// One creator: their own pair (mode "own") or back to the site rates (mode "site").
export async function setCreatorFeeRates(
  creatorId: number,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOwner();
  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return fail("That request is not valid.");
  const mode = formData.get("mode");
  if (mode !== "own" && mode !== "site") return fail("Choose the site rates or their own rates.");
  let override = null;
  if (mode === "own") {
    const parsed = parseRates(formData.get("platform"), formData.get("processing"));
    if (!parsed.ok) return fail(parsed.error);
    override = parsed.rates;
  }
  const db = getDb();
  if (!db) return fail(NO_DB);
  try {
    const r = await saveCreatorRates(db as unknown as LedgerDb, [creatorId], override, reasonOf(formData));
    refresh([creatorId]);
    if (r.missing > 0) return fail("That creator was not found.");
    if (r.changed === 0) return ok("Nothing changed: they are already set that way.");
    return ok(
      override
        ? `Saved. This creator now pays ${describeRates(override)} on tips made from now on. Earlier tips keep their rate.`
        : "Saved. This creator now follows the site rates on tips made from now on. Earlier tips keep their rate.",
    );
  } catch (err) {
    console.error("Admin: could not save a creator's fee rates", err);
    return fail(isUndefinedColumn(err) ? NOT_MIGRATED : "Could not save. The server log has the reason.");
  }
}

// The ticked creators in one go: all given the same own pair (mode "own"), or all handed back to the
// site rates (mode "site"). Creators already set that way are left alone.
export async function applyFeeRates(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireOwner();
  // The ticked creators arrive as one comma-separated field (the confirm panel carries plain text).
  const ids = formData
    .getAll("ids")
    .flatMap((v) => (typeof v === "string" ? v.split(",") : []))
    .map((v) => v.trim())
    .filter((v) => v !== "")
    .map((v) => (/^\d{1,12}$/.test(v) ? Number(v) : NaN));
  if (ids.length === 0) return fail("Tick at least one creator first.");
  if (ids.length > BULK_MAX || ids.some((n) => !Number.isSafeInteger(n) || n < 1)) {
    return fail(`Choose between 1 and ${BULK_MAX} creators.`);
  }
  const mode = formData.get("mode");
  if (mode !== "own" && mode !== "site") return fail("Choose the site rates or one pair of rates.");
  let override = null;
  if (mode === "own") {
    const parsed = parseRates(formData.get("platform"), formData.get("processing"));
    if (!parsed.ok) return fail(parsed.error);
    override = parsed.rates;
  }
  const db = getDb();
  if (!db) return fail(NO_DB);
  try {
    const r = await saveCreatorRates(db as unknown as LedgerDb, ids, override, reasonOf(formData));
    refresh(ids);
    const where = override ? `their own ${describeRates(override)}` : "the site rates";
    if (r.changed === 0) return ok(`Nothing changed: ${r.unchanged} of ${r.unchanged + r.missing} were already on ${where}.`);
    return ok(
      `Saved. ${r.changed} creator${r.changed === 1 ? "" : "s"} now on ${where}` +
        `${r.unchanged ? `, ${r.unchanged} already were` : ""}${r.missing ? `, ${r.missing} not found` : ""}. Earlier tips keep their rate.`,
    );
  } catch (err) {
    console.error("Admin: could not apply the fee rates", err);
    return fail(isUndefinedColumn(err) ? NOT_MIGRATED : "Could not save. The server log has the reason.");
  }
}
