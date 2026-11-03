"use client";

import { SuccessBlock } from "@/components/tip/blocks/SuccessBlock";
import { findBlock } from "@/lib/page-doc/blocks";
import type { PageDoc } from "@/lib/page-doc/types";

// The screen shown after a tip, with made-up values, so the tests can look at it without a payment.
// A client component because the screens take a function ("Tip again"). `owner` only picks the
// made-up name: the screen's style comes from the document, as on the real page.
export function SuccessFixture({ doc, owner }: { doc: PageDoc; owner: boolean }) {
  return (
    <SuccessBlock
      block={findBlock(doc, "successScreen")}
      amountPaise={10000}
      displayName={owner ? "AcePressure" : "Sample Creator"}
      handle="samplecreator"
      anonymous={false}
      alertMessage="Great stream today!"
      alertMode="split"
      pinned={false}
      reference="order_sample"
      onAgain={() => {}}
    />
  );
}
