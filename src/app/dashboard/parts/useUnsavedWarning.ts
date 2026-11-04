"use client";

import { useEffect } from "react";

// Asks the browser to confirm before the tab is closed or reloaded while a form holds edits that
// were not saved. (Links inside the site are not caught; the browser only guards leaving the page.)
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
