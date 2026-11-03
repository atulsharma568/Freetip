"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";

// The session provider asks the server who is signed in on load and on every focus
// change. An OBS overlay has no signed-in person, so it skips that.
export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The preview page under /overlay is an ordinary site page with the nav, which needs it.
  const bare = pathname.startsWith("/overlay/") && !pathname.startsWith("/overlay/preview");
  if (bare) return <>{children}</>;
  return <SessionProvider>{children}</SessionProvider>;
}
