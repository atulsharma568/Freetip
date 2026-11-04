import { readFormBody, settleFromBody } from "@/lib/plan-settle";

// Where PayU sends the creator's browser after paying (`surl`) or failing (`furl`): a form POST
// from PayU's page. The creator's sign-in cookie is not sent on this cross-site POST, so the route
// needs no session: it settles the order from PayU's signed fields (the checks are in
// plan-orders.ts) and sends the browser on to the plans page with a plain word for the outcome.
// The webhook (/api/webhooks/payu) reaches the same settle, so whichever arrives first wins and
// the other changes nothing.
export async function POST(request: Request): Promise<Response> {
  const body = await readFormBody(request);
  const outcome = body ? await settleFromBody(body) : null;
  const word =
    !outcome ? "problem"
    : outcome.status === "activated" || outcome.status === "already_paid" ? "paid"
    : outcome.status === "failed" ? "failed"
    : outcome.status === "pending" || outcome.status === "unavailable" ? "pending"
    : "problem";
  // 303 turns the POST into a GET of the plans page.
  return Response.redirect(new URL(`/dashboard/plans?payment=${word}`, request.url), 303);
}
