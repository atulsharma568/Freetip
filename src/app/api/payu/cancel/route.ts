import { SITE_URL } from "@/lib/url";

// Where PayU sends the creator's browser when they press Cancel on PayU's page (`curl`). Nothing
// was paid and nothing changes; the order stays pending and the daily check closes it out.
function back(): Response {
  return Response.redirect(`${SITE_URL}/dashboard/plans?payment=cancelled`, 303);
}
export const GET = back;
export const POST = back;
