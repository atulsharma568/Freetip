// Where PayU sends the creator's browser when they press Cancel on PayU's page (`curl`). Nothing
// was paid and nothing changes; the order stays pending and the daily check closes it out.
function back(request: Request): Response {
  return Response.redirect(new URL("/dashboard/plans?payment=cancelled", request.url), 303);
}
export const GET = back;
export const POST = back;
