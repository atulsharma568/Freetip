import { readFormBody, settleFromBody } from "@/lib/plan-settle";

// PayU's server-to-server notice (set in PayU's dashboard under Webhooks). PayU calls this the most
// reliable word on a payment, so it settles the order exactly as the browser return does; the two
// share one settle and whichever arrives first wins.
//   Successful / Failed payments: a form POST with the same signed fields as the browser return.
//   Refund / Dispute: JSON, not signed. Nothing is changed by them (a refund is the owner's call,
//   made by hand in the owner console); they are acknowledged and logged.
// Answers: 200 when the notice was understood (paid, already paid, failed, still pending, or not
// believed, which retrying cannot fix); 400 for a signature that does not match; 503 when PayU
// could not be asked, so a retry can still succeed.
export async function POST(request: Request): Promise<Response> {
  const type = request.headers.get("content-type") ?? "";
  if (/application\/json/i.test(type)) {
    console.error("PayU notice (refund or dispute) received; handle by hand in the owner console.");
    return new Response("OK");
  }
  const body = await readFormBody(request);
  if (!body) return new Response("Unreadable", { status: 400 });
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
