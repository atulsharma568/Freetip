# PayU: what we read, and how the plan purchase uses it

Read on 2026-11-04 from PayU's own developer documentation (docs.payu.in). Nothing here was tried against a live PayU account yet; the first real test payment (with the owner's test keys) settles anything marked "to confirm".

## Facts, with where they come from

- **Pages used:** PayU Hosted Checkout ("Web Integration - PayU Hosted", `docs.payu.in/docs/prebuilt-checkout-page-integration`), "Generate Hash for Server-to-Server integration", "Webhook Events and Sample Payloads", and the "Verify Payment API" reference.
- **Where the browser is sent:** the form is POSTed to `https://secure.payu.in/_payment` (live) or `https://test.payu.in/_payment` (test).
- **Required fields:** `key`, `txnid`, `amount` (a string such as `10.00`), `productinfo`, `firstname`, `email`, `phone`, `surl`, `furl`, `hash`. `surl` and `furl` must be https and reachable from the internet. Optional: `curl` (cancel), `udf1` to `udf5`, `lastname`.
- **Request hash:** `sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)`, lowercase hex, built on the server. The salt is never sent. Unused udf slots stay as empty strings; the pipes stay.
- **What comes back:** PayU POSTs the customer's browser to `surl` (success) or `furl` (failure) with URL-encoded fields: `mihpayid`, `txnid`, `status` (`success`, `failure`, or `pending` for some bank transfers), `unmappedstatus` (`captured`, `failed`, `userCancelled`), `amount`, `key`, `hash`, `error`, `error_Message`, `email`, `firstname`, `productinfo`, `udf1` to `udf5`, and more.
- **Reply hash (reverse):** `sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)`. Compare it with the posted `hash`. PayU: "Trust the result only if the hash matches."
- **Server-to-server notice (webhook):** set in PayU's dashboard (events Successful, Failed, Refund, Dispute). Success and Failed are form-encoded POSTs with the same fields and a `hash`. Refund and Dispute are JSON with no hash. Retry behaviour and the expected reply are not documented; webhook calls come from fixed PayU IP addresses. PayU calls the webhook "the most reliable way to confirm transaction status" and says not to update an order from the browser return alone.
- **Verify Payment API:** POST `application/x-www-form-urlencoded` to `https://info.payu.in/merchant/postservice.php?form=2` (live) or `https://test.payu.in/merchant/postservice.php?form=2` (test), fields `key`, `command=verify_payment`, `var1=<txnid>` (several joined with `|`), `hash=sha512(key|command|var1|salt)`. The answer has `status` (1 or 0), `msg`, and `transaction_details` keyed by `txnid`, each with `status`, `unmappedstatus`, `amt`, `mihpayid`, `error_code`. A txnid PayU never saw comes back with `status` "Not Found".
- **Test data:** card `5123456789012346`, any future expiry, CVV `123`, OTP `123456` (a failing card is `5123456789012340`); UPI `anything@payu`.


1. **A payment is believed only when three things agree:** the reply hash matches (checked in constant time), the amount and `txnid` match the order we created, and PayU's Verify Payment API, called by our server, says the same transaction is `success` with the same amount. The browser return and the webhook both lead to this one check, so a forged form post cannot switch anything on.
2. **Exactly once.** The order row is locked and moves `pending` to `paid` in one database transaction together with the switch-on; a second delivery finds it already `paid` and does nothing. A failure only fills a pending order and never overwrites a paid one.
3. **If PayU cannot be reached for the check,** the order stays pending, the webhook answers "try again later", and a daily job checks every pending order against the Verify Payment API.
4. **A pass adds to `users.paid_features` and remembers exactly which keys it added** (`users.pass_keys`), so expiry takes away only those and never the owner's manual ticks. Buying again before the end adds the new term to the end date. The owner's per-creator switch box stays as it is; saving it forgets pass keys the owner has unticked.
5. **Prices stay in `src/lib/pricing.ts`** (empty until the owner gives them); no order can be made while they are empty.
6. **PayU wants a mobile number** (`phone` is mandatory). We do not hold one for creators, so the Buy form asks the creator for it; it goes to PayU and is not kept on our side beyond what PayU's reply echoes. To confirm with the owner before building the form.
7. **To confirm on the first real payment:** the maximum length of `txnid` (we use 20 letters and digits), whether the browser return reaches our `surl` as a POST in the way described, and what PayU does on a webhook that we answer with an error.
