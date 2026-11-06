// Razorpay's checkout popup, loaded with a <script> tag when it is needed (the tip page and the Buy form
// on /dashboard/plans share this, so the script is only fetched once).

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, any>) => { open(): void };
  }
}

export function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && typeof window.Razorpay !== "undefined") {
      resolve();
      return;
    }
    const existing = document.getElementById("rzp-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Script load error")));
      return;
    }
    const script = document.createElement("script");
    script.id = "rzp-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => {
      // Drop the dead tag so a retry builds a fresh one instead of waiting on this.
      script.remove();
      reject(new Error("Failed to load Razorpay"));
    };
    document.body.appendChild(script);
  });
}
