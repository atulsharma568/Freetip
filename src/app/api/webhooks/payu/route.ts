import { forLog, readFormBody, readJsonBody, settleFromBody } from "@/lib/plan-settle";

// PayU's server-to-server notice (set in PayU's dashboard under Webhooks). PayU calls this the most
// reliable word on a payment, so it settles the order exactly as the browser return does; the two
// share one settle and whichever arrives first wins.
//   Successful / Failed payments: a form POST with the same signed fields as the browser return.
//     (If one ever arrives as JSON with the same fields it is settled the same way.)
//   Refund / Dispute: JSON, not signed. Nothing is changed by them (a refund is the owner's call,
//   made by hand in the owner console); they are acknowledged and logged with the reference.
// Answers: 200 when the notice was understood (paid, already paid, failed, still pending, or not
// believed, which retrying cannot fix); 400 for a signature that does not match; 503 when PayU
// could not confirm (unreachable, or not caught up yet), so a retry can still succeed.
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  const type = request.headers.get("content-type") ?? "";
  let body: Record<string, string | number> | null;
  if (/application\/json/i.test(type)) {
    body = await readJsonBody(request);
    // A JSON notice that is not a signed payment (refund, dispute, anything else): acknowledged, logged.
    if (!body || typeof body.hash !== "string" || typeof body.txnid !== "string") {
      const ref = body ? forLog(String(body.merchantTxnId ?? body.txn_id ?? body.txnid ?? ""), 25) : "";
      const what = body ? forLog(String(body.event ?? body.type ?? body.action ?? "notice"), 30) : "unreadable";
      console.error(`PayU notice (${what}) for ${ref || "an unknown payment"}: refunds and disputes are handled by hand in the owner console.`);
      return new Response("OK");
    }
  } else {
    body = await readFormBody(request);
    if (!body) return new Response("Unreadable", { status: 400 });
  }
  const outcome = await settleFromBody(body);
  switch (outcome.status) {
    case "not_set_up":
      return new Response("Not set up", { status: 503 });
    case "unavailable":
      return new Response("Try again", { status: 503 });
    case "rejected":
      return outcome.reason === "bad_hash" ? new Response("Invalid signature", { status: 400 }) : new Response("Ignored");
    default:
      return new Response("OK");
  }
}
