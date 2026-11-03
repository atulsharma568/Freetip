"use client";

import { OwnerSuccess } from "@/components/tip/OwnerSuccess";
import { SuccessScreen } from "@/components/tip/SuccessScreen";

// The screen shown after a tip, with made-up values, so the tests can look at it without a payment.
// A client component because the screens take a function ("Tip again").
export function SuccessFixture({ owner }: { owner: boolean }) {
  const Success = owner ? OwnerSuccess : SuccessScreen;
  return (
    <Success
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
