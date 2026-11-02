import type { Tone } from "@/components/admin/tones";

// Which Razorpay key the server holds. Only a live key makes real money, so the owner
// console shows this on every page: a test key looks the same as a live one otherwise.
export interface KeyMode {
  tone: Tone;
  short: string;
  long: string;
}

export function razorpayKeyMode(): KeyMode {
  const key = process.env.RAZORPAY_KEY_ID;
  if (!key) return { tone: "neutral", short: "No payment key", long: "Razorpay · no key set" };
  if (key.startsWith("rzp_live_")) return { tone: "good", short: "Live payments", long: "Razorpay · live key set" };
  return { tone: "warn", short: "Test payments", long: "Razorpay · test key set (test money is not counted)" };
}
