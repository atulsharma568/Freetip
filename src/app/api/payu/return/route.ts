import { SITE_URL } from "@/lib/url";
import { readFormBody, settleFromBody } from "@/lib/plan-settle";

// Where PayU sends the creator's browser after paying (`surl`) or failing (`furl`): a form POST
// from PayU's page. The creator's sign-in cookie is not sent on this cross-site POST, so the route
// needs no session: it settles the order from PayU's signed fields (the checks are in
// plan-orders.ts) and sends the browser on to the plans page with a plain word for the outcome.
// The word is only a hint for what to say; the page reads the database for the truth. The webhook
// (/api/webhooks/payu) reaches the same settle, so whichever arrives first wins and the other
// changes nothing. Whatever goes wrong, the creator lands on the plans page, never an error page.
// Asking PayU twice (with a short wait between) can take a while; the same limit as the webhook.
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  let word = "problem";
  try {
    const body = await readFormBody(request);
    const outcome = body ? await settleFromBody(body) : null;
    word =
      !outcome ? "problem"
      : outcome.status === "activated" || outcome.status === "already_paid" ? "paid"
      : outcome.status === "failed" ? "failed"
      : outcome.status === "pending" || outcome.status === "unavailable" ? "pending"
      : "problem";
  } catch (err) {
    console.error("PayU return could not be handled:", err instanceof Error ? err.message : err);
    word = "pending";
  }
  // 303 turns the POST into a GET of the plans page. The address is the site's own, never taken
  // from the request.
  return Response.redirect(`${SITE_URL}/dashboard/plans?payment=${word}`, 303);
}
