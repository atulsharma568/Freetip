export type OwnerAccess = "unauthenticated" | "unauthorized" | "authorized";

export function parseOwnerGoogleIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isOwnerGoogleId(
  googleId: string | undefined,
  allowedIds: readonly string[],
): boolean {
  return Boolean(googleId && allowedIds.includes(googleId));
}
