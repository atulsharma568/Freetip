import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  isOwnerGoogleId,
  parseOwnerGoogleIds,
  type OwnerAccess,
} from "@/lib/owner-auth-core";

type SessionWithGoogleId = {
  user?: {
    googleId?: string;
  } | null;
};

export { isOwnerGoogleId, parseOwnerGoogleIds } from "@/lib/owner-auth-core";
export type { OwnerAccess } from "@/lib/owner-auth-core";

export function configuredOwnerGoogleIds(): string[] {
  return parseOwnerGoogleIds(
    process.env.OWNER_GOOGLE_IDS ?? process.env.OWNER_GOOGLE_ID,
  );
}

// Read-only helpers (friends who may look but not change anything). Listed in
// ADMIN_VIEWER_GOOGLE_IDS; an owner is never treated as a mere viewer.
export function configuredViewerGoogleIds(): string[] {
  return parseOwnerGoogleIds(process.env.ADMIN_VIEWER_GOOGLE_IDS);
}

export type AdminRole = "owner" | "viewer";

export async function getOwnerAccess(): Promise<OwnerAccess> {
  const session = (await auth()) as SessionWithGoogleId | null;
  if (!session?.user) return "unauthenticated";

  const googleId = session.user.googleId;
  return isOwnerGoogleId(googleId, configuredOwnerGoogleIds())
    ? "authorized"
    : "unauthorized";
}

export async function requireOwner(): Promise<void> {
  const access = await getOwnerAccess();

  if (access === "unauthenticated") redirect("/signin");
  if (access === "unauthorized") notFound();
}

// For the few read-only admin pages (and the layout): an owner or a listed viewer.
// Everything that changes something, and every other page, keeps `requireOwner`,
// which a viewer fails (404).
export async function requireAdminViewer(): Promise<AdminRole> {
  const session = (await auth()) as SessionWithGoogleId | null;
  if (!session?.user) redirect("/signin");

  const googleId = session.user.googleId;
  if (isOwnerGoogleId(googleId, configuredOwnerGoogleIds())) return "owner";
  if (isOwnerGoogleId(googleId, configuredViewerGoogleIds())) return "viewer";
  notFound();
}
