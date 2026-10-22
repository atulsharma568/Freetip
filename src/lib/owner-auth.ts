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
