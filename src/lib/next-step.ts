export interface NextStepInput {
  creatorStatus: "pending" | "active" | "suspended";
  onboardingState: "not_started" | "submitted" | "active" | "rejected";
  hasOverlayLink: boolean;
  // Captured tips ever received.
  tipCount: number;
}

export interface NextStep {
  title: string;
  body: string;
  // An in-page anchor on the dashboard.
  href: string;
  action: string;
}

// The one thing a creator should do next, or null when there is nothing left.
// Order matters: money setup first, then the stream, then the first share.
export function nextStep(s: NextStepInput): NextStep | null {
  if (s.creatorStatus === "suspended") return null;

  if (s.creatorStatus === "pending") {
    if (s.onboardingState === "submitted") {
      return {
        title: "Payout details are being checked",
        body: "Nothing to do for now. Meanwhile, add alerts to your stream.",
        href: "#alerts",
        action: "Set up alerts",
      };
    }
    return {
      title: s.onboardingState === "rejected" ? "Fix your payout details" : "Add your payout details",
      body: "Tips open once your payout details are in.",
      href: "#payout",
      action: s.onboardingState === "rejected" ? "Review details" : "Add details",
    };
  }

  if (!s.hasOverlayLink) {
    return {
      title: "Add alerts to your stream",
      body: "Create your overlay link and paste it into OBS as a browser source.",
      href: "#alerts",
      action: "Get the link",
    };
  }

  if (s.tipCount === 0) {
    return {
      title: "Share your link",
      body: "Put your tip page or QR code where your viewers will see it.",
      href: "#tip-page",
      action: "Show my link",
    };
  }

  return null;
}
