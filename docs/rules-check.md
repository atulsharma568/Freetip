
The owner has no budget for a lawyer or accountant (2026-10-31) and asked for the rules to be checked from public sources. This is a reading of the rules, not legal advice and not a sign-off: it says what the text says, what stays unclear, and which choice carries the least risk. Sources are at the end.

## 1. Is paying creators from our own account "payment aggregation"? (the big one)

What the RBI Payment Aggregator Directions of 15 Sep 2025 say (read from RBI's own page):

- cl. 4(i): a payment aggregator "facilitates aggregation of payments made by customers to the merchants" and "subsequently settles the collected funds to such merchants".
- cl. 4(f): a merchant is "an entity or a marketplace that sells goods, provides services, or offers investment products". A creator who gets tips for their stream is, on a plain reading, a merchant of that kind.
- cl. 10(a): an aggregator may aggregate funds only for a merchant it has a contract with. cl. 16(a): a non-bank aggregator must hold merchants' money in a separate escrow account at a scheduled bank. cl. 6(a): authorisation needs ₹15 crore net worth, ₹25 crore by year three. cl. 10(b): an aggregator may not also run a marketplace.
- Payments to a third party on a merchant's instruction are allowed only for merchants above ₹40 lakh turnover (Table 1, debit (iv)).

**Reading:** if fans pay Freetip's Razorpay account and Freetip then pays about 92% of it on to each creator, that is "collect for the creator, then settle to the creator". The only way out is to say the tip is Freetip's own revenue and the creator payout is a separate payment, but a tip that is passed on in a fixed share does not look like that. So the manual rail in `docs/payout-design.md` section 3 is the risky design. Nothing is paid out yet, so nothing has gone wrong; the question is what to build.

**Models that stay clear of it (no Freetip-held pool of creator money):**

1. **A licensed aggregator does the splitting.** Freetip is the "marketplace" and creators are onboarded as vendors with their own bank account or UPI check; the aggregator settles to each creator directly. Razorpay Route is this, but Razorpay's pages tie it to ₹40 lakh turnover and a use-case review. Cashfree Easy Split is built for the same job and lists creator platforms as a use case; its own page says some settlement options depend on "configuration and eligibility", and what a new small platform needs is not published. Both are worth a free email each.
2. **The creator's own merchant account** (what StreamTipz describes: tips go to the creator's own UPI or merchant ID, the platform never touches them, and it earns from tokens). Cleanest legally, hardest for creators, and it changes the fee model.
3. **Coffee & Toffee style**: Razorpay Route linked accounts, a delay of 2 days after payment (7 in the first month), the creator pays Razorpay's fee. Shows it is done by small Indian platforms, but I could not confirm their legal basis.

**What I recommend (our judgment, owner decides):** do not build the manual payout sheet (step 4). Ask Razorpay (draft already in `docs/razorpay-email-draft.md`) and Cashfree whether a new platform with no turnover can use split settlement, and move to model 1 if either says yes. If both say no, model 2 is the fallback. Steps 1 to 3 (the books, reversals, balances) stay useful in every model, since fees, reports and the owner's view still need them; only the payout step changes. Keep the site's wording ("a regular schedule", no day promised) until the model is chosen.

## 2. GST (tax on our fee), from public articles

- Our 5% fee and the 2.75% processing charge are services Freetip supplies; the usual rate on platform commissions is 18%. Registration threshold for services is ₹20 lakh a year (₹10 lakh in special-category states). Several articles say a business making only inter-state service supplies need not register below the threshold (Notification 10/2017-Integrated Tax); other articles say the opposite, so this is **not settled by my reading**. Registration is compulsory regardless of turnover if you are an e-commerce operator who must collect GST at source.
- Cheap and safe: keep the books as they are (every fee is a separate ledger line already), decide on registration before the first real payout or at ₹20 lakh, whichever is first, and ask a CA for a one-off paid answer only if volume appears.
- The 18% on the 5% fee is not in the creator's ₹92.25 today. If registration is needed, the fee becomes 5% plus GST or the creator's share falls. This is an open pricing question, not a code one.

## 3. TDS and GST TCS

- Income Tax s.194-O (0.1% with PAN, 5% without; individuals exempt up to ₹5 lakh a year with PAN) and GST s.52 TCS (0.5%) apply to an "e-commerce operator" who runs a digital facility for the "sale of goods and services". I found no source that says whether voluntary tips count as a sale of services, and none that covers creator platforms. **Unresolved.**
- Cheap and safe: if we ever pay out, ask creators for PAN at that point (not now: the privacy policy says we do not collect it) and keep a payout statement per creator. If a deduction turns out to apply, the data is there. Do not collect PAN until step 4 is real.

## 4. What this changes in the repo

- Step 4 (payout sheet) stays blocked, now for a stated reason with a recommended way out (above), not "waiting for a lawyer".
- Questions for support teams (free): the Razorpay draft exists; a short Cashfree question is the next draft.

## Sources

- RBI, Master Direction on Regulation of Payment Aggregators, 15 Sep 2025: https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896
- IndiaCorpLaw, "Decoding RBI's overhaul of the Payment Aggregator Directions": https://indiacorplaw.in/2025/10/09/decoding-rbis-overhaul-of-the-payment-aggregator-directions/
- Cashfree Easy Split features: https://www.cashfree.com/docs/payments/split/features
- StreamTipz: https://streamtipz.in/ ; SuperTip about page: https://supertip.live/about-us ; Coffee & Toffee: https://timewheel.co.in/coffee-and-toffee
- GST for service providers and the intermediary change: https://taxgarden.in/blog/gst-intermediary-services-igst-section-13-8-b-india-2026 and https://calcguru.in/gst-registration-threshold-20-40-lakh/
- 194-O and s.52: https://cleartax.in/s/section-194o and https://limpo.in/blog/tcs-tds-ecommerce-sellers-india-section-52-194o
