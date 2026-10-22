"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { HANDLE_PATTERN } from "@/lib/waitlist";

export type HandleState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; handle: string };

export const HANDLE_IDLE: HandleState = { status: "idle" };

export async function setHandle(
  _prev: HandleState,
  form: FormData,
): Promise<HandleState> {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const handle = String(form.get("handle") ?? "")
    .toLowerCase()
    .trim();

  if (!HANDLE_PATTERN.test(handle)) {
    return { status: "error", message: "3 to 20 letters, numbers or _" };
  }

  const db = getDb();
  if (!db) {
    return { status: "error", message: "Database unavailable — try again shortly" };
  }

  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");

  try {
    const rows = await db<{ handle: string }[]>`
      update users
        set handle = ${handle}
      where google_id = ${googleId}
        and handle is null
      returning handle
    `;

    if (!rows.length) {
      return { status: "error", message: "Your handle is already set" };
    }

    redirect("/dashboard");
  } catch (err: unknown) {
    if (err instanceof Error && err.message.toLowerCase().includes("unique")) {
      return { status: "error", message: "That handle is taken — try another" };
    }
    throw err;
  }
}
