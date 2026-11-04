// A creator's UPI ID (virtual payment address). Format only: 3+ characters, @, a bank
// handle of 3+ letters, e.g. 9876543210@paytm. We cannot check that the account exists.
const UPI_VPA_PATTERN = /^[a-zA-Z0-9._-]{3,}@[a-zA-Z]{3,}$/;

export const UPI_MESSAGE = "Enter a valid UPI ID, e.g. name@upi";

export type UpiCheck = { ok: true; upiVpa: string } | { ok: false; message: string };

export function checkUpi(raw: string): UpiCheck {
  const upiVpa = raw.trim().toLowerCase();
  if (!UPI_VPA_PATTERN.test(upiVpa)) return { ok: false, message: UPI_MESSAGE };
  return { ok: true, upiVpa };
}
