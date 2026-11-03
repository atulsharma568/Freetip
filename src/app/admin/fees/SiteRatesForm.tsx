"use client";

import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { RateFields, useRateFields } from "@/components/admin/RateFields";
import { setSiteFeeRates } from "@/app/actions/fees";
import type { FeeRates } from "@/lib/money";

// The rates every creator follows unless they have their own. Saving is a two-step confirm that says
// how many creators it reaches, because this is the one change that moves everyone at once.
export function SiteRatesForm({ site, following }: { site: FeeRates; following: number }) {
  const fields = useRateFields(site);
  return (
    <div className="space-y-4">
      <RateFields state={fields} idPrefix="site" />
      <ConfirmAction
        action={setSiteFeeRates}
        label="Save site rates"
        tone="primary"
        size="md"
        disabled={!fields.parsed.ok}
        description={`This changes what ${following} creator${following === 1 ? "" : "s"} who follow the site rates pay on tips made from now on. Creators with their own rates, and tips already made, are not touched.`}
        confirmLabel="Yes, save"
        pendingLabel="Saving…"
        askReason
        hidden={{ platform: fields.platform, processing: fields.processing }}
      />
    </div>
  );
}
