"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// While PayU has not yet confirmed a payment, ask the server for the page again every few seconds
// (a handful of times, then stop). The server decides what the page says; this only re-asks.
export function PendingRefresh({ everyMs = 5000, times = 8 }: { everyMs?: number; times?: number }) {
  const router = useRouter();
  useEffect(() => {
    let left = times;
    const timer = setInterval(() => {
      left -= 1;
      router.refresh();
      if (left <= 0) clearInterval(timer);
    }, everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs, times]);
  return null;
}
