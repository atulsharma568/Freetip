"use client";

import type { ComponentProps } from "react";
import { OwnerSuccess } from "@/components/tip/OwnerSuccess";
import { SuccessScreen } from "@/components/tip/SuccessScreen";
import type { Block } from "@/lib/page-doc/types";

type SuccessProps = ComponentProps<typeof OwnerSuccess>;

// The screen that replaces the page after a tip. The document only picks the style. It ignores
// `visible` and a missing block on purpose: a fan who has paid always sees the confirmation.
export function SuccessBlock({ block, ...screen }: { block: Block<"successScreen"> | undefined } & SuccessProps) {
  const Success = block?.settings.style === "owner" ? OwnerSuccess : SuccessScreen;
  return <Success {...screen} />;
}
