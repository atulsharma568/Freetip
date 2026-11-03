"use client";

import { useEffect } from "react";

// A render error in an OBS overlay must not put the site's error page over a live
// stream. Draw nothing, log it, and try again in a few seconds.
export default function OverlayError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    const t = setTimeout(() => retry(), 5000);
    return () => clearTimeout(t);
  }, [error, retry]);

  return null;
}
