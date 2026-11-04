"use client";

import { pillOutline } from "../../parts/styles";

// Opens the browser's print window, which also offers "Save as PDF".
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${pillOutline} print:hidden`}>
      Print or save as PDF
    </button>
  );
}
