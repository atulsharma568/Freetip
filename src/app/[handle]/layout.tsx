import { notFound } from "next/navigation";
import { getCreator } from "./creator";
import { isClosedGoogleId } from "@/lib/account-close";
import { HANDLE_PATTERN } from "@/lib/waitlist";

// loading.tsx starts streaming before the page runs, so a notFound() in the page
// would answer 200. Checking here, above that boundary, makes an unknown or
// closed handle a real 404 (search engines treat a 200 as a soft 404).
// getCreator is cached per request, so the page's own lookup costs nothing extra.
export default async function CreatorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  if (!HANDLE_PATTERN.test(handle)) notFound();
  const creator = await getCreator(handle);
  if (!creator || isClosedGoogleId(creator.google_id)) notFound();
  return children;
}
