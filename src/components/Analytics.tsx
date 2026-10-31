"use client";

import Link from "next/link";
import Script from "next/script";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const KEY = "freetip-analytics-consent";

// Routes where no banner or tracking should ever appear: the OBS overlay runs
// in a browser source, and the owner and creator areas are signed-in tools.
const QUIET = ["/overlay", "/admin", "/dashboard"];

type Choice = "granted" | "denied" | null;

const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
// Server render and the first client render both see "pending", so they match.
let memory: Choice = null;

function readChoice(): Choice {
  if (memory) return memory;
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

// Google Analytics, dormant until NEXT_PUBLIC_GA_ID is set. Nothing loads and
// no cookie is set until the visitor presses Accept.
export function Analytics() {
  const pathname = usePathname();
  const choice = useSyncExternalStore(subscribe, readChoice, () => "pending" as const);

  if (!GA_ID || choice === "pending" || QUIET.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  function decide(next: "granted" | "denied") {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // The choice then lasts for this visit only.
    }
    memory = next;
    listeners.forEach((fn) => fn());
  }

  return (
    <>
      {choice === "granted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {choice === null && (
        <div
          role="region"
          aria-label="Analytics choice"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-field border border-line bg-surface p-4 text-sm text-text sm:flex-row sm:items-center"
        >
          <p className="flex-1 text-muted">
            May we count visits with Google Analytics? It sets cookies. Say no and nothing
            loads. <Link href="/privacy#cookies" className="link-line text-text">Details</Link>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => decide("denied")}
              className="h-10 rounded-full border border-control px-4 text-text"
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={() => decide("granted")}
              className="h-10 rounded-full bg-accent px-4 font-semibold text-ink"
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}
