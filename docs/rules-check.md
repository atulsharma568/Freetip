# Rules check, read from public sources (2026-10-31), replacing the lawyer and accountant for now

**Update 2026-11-04:** no provider has agreed to split and settle, so the owner decided to pay creators by hand from their own account anyway (`OPERATIONS.md` 7k). The reading below has not changed and the risk it describes is still open; the owner accepted it.

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

## 2. GST (tax on our fee and on the paid plan), re-read 2026-11-04

The owner has no budget for an accountant and asked for a decision from what is found. This is a reading of public sources, not a sign-off from a CA; it says what I found, what stays unclear, and what I chose.

**What I found.**
- **The conflict in the earlier reading is settled by the official text.** CBIC Notification 10/2017-Integrated Tax (13 Oct 2017, under section 23(2) CGST) exempts from registration any person whose supplies are inter-State supplies of services, while aggregate turnover on an all-India basis, on one PAN, is at most ₹20 lakh in a financial year (₹10 lakh in special-category states other than J&K). It does not cover goods. Aggregate turnover counts every supply on that PAN, exempt ones and exports included, and not the GST itself.
- **Exceptions that force registration whatever the turnover** (section 24): among them an e-commerce operator who must collect TCS under section 52, and anyone liable to pay tax under reverse charge.
- **Rate once registered:** software and online subscriptions are SAC 9983 at 18% (9% plus 9%, or 18% IGST between states). No concession by size. These are practitioner sources, not the CBIC rate list; check the rate list when registering.
- **Our 5% fee, the 2.75% processing charge and the paid plan are Freetip's own supplies for a price**, so they count towards turnover and carry 18% once Freetip is registered.
- **Do tips themselves count as a supply?** No ruling or circular settles it. The better argument for a pure voluntary tip (nothing asked in return) is that it is a gift, not a supply; where the fan gets something back (a pinned message, a pick that plays a GIF) the argument is weaker. Practitioner blogs disagree.

**What I decided (owner may overrule).**
1. **No GST registration yet.** While Freetip's all-India turnover on the owner's PAN stays under ₹20 lakh a year, the exemption applies to our fee and to the plan. The plan price is shown as the final amount with no GST added, and the buyer gets a plain receipt that says nothing about GST (an unregistered seller cannot issue a tax invoice).
2. **The worry is what counts as turnover.** On the plain reading it is our fees and plan sales only. On the pessimistic reading (Freetip is treated as collecting tips for itself, which is the same pass-through doubt as section 1) it is gross tips, and ₹20 lakh of tips arrives long before ₹20 lakh of fees. So the trigger is: **register when the larger of (fees plus plan sales) and (gross tips) in a financial year reaches ₹15 lakh**, leaving room, because registration is due within 30 days of crossing and tax is owed from the crossing date. A running figure of both numbers on the owner's finance page would make this automatic; not built.
3. **Price with room.** Once registered, 18% comes out of the same price unless it is raised: ₹299 would leave about ₹253. Decide the final prices knowing that.
4. **Revisit** the day a ruling or circular on tips appears, the day the section 1 payout model is chosen, or at the ₹15 lakh trigger.

**What stays unclear:** whether tips are a supply; whether Freetip counts as a principal for gross tips; and the exact special-category-state rule if the owner's registered address is in one.

## 3. TDS and GST TCS, re-read 2026-11-04

**What I found.**
- **GST TCS (section 52):** 0.5% in total since 10 July 2024 (0.25% plus 0.25%, or 0.5% IGST). It applies to an operator that collects the money for supplies made through its platform, on the net value of taxable supplies, reported in GSTR-8; registration is compulsory under section 24(x) only for an operator who must collect it. Selling your own services on your own site is not covered.
- **Income tax 194-O:** 0.1% since 1 Oct 2024 on the gross amount paid to a resident "e-commerce participant" for sale of goods or services through the operator's platform; an individual or HUF with gross sales up to ₹5 lakh a year who gave PAN or Aadhaar is exempt; without PAN the rate is usually 5%. From 1 April 2026 it sits in section 393(1) of the Income-tax Act, 2025. A law-firm note says livestream donations have, in practice, no withholding.
- Both depend on the same question as above: is a voluntary tip "a sale of goods or services"? No source I found says yes for a pure tip.

**What I decided.** Collect no TCS and deduct no TDS on tips for now: a voluntary tip with nothing asked in return is, on the better reading, not a sale of a service. The riskier cases are the ones where the fan gets something back (a pinned message, a pick that plays a GIF); these are switched off by default and the owner has not offered pinned messages publicly. If payouts start (section 1), ask creators for PAN at that point (not now, the privacy policy says we do not collect it) and keep a statement per creator so a deduction can be applied later. Revisit with the section 2 triggers.

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
- CBIC Notification 10/2017-Integrated Tax: https://cbic-gst.gov.in/hindi/pdf/integrated-tax/10_2017_IT.pdf (also https://keralataxes.gov.in/wp-content/uploads/2018/11/10_2017_IT.pdf); explainer: https://taxguru.in/goods-and-service-tax/gst-not-payable-on-inter-state-supplies-of-taxable-services-by-exempt-persons.html
- Section 24 CGST Act text: https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter6/section24_v1.00.html
- GST on SaaS (practitioner): https://www.kanakkupillai.com/learn/gst-on-subscription-revenue/ ; https://ampuesto.in/blog/gst-on-saas-digital-services-india/
- GST TCS section 52: https://taxguru.in/goods-and-service-tax/gst-tcs-commerce-operators-section-52-gstr-8-0-5-percent-rate.html ; GST Council FAQ: https://gstcouncil.gov.in/sites/default/files/2024-02/faq-e-commerc.pdf
- Section 194-O: https://cleartax.in/s/section-194o ; https://blog.tdsman.com/2026/07/tds-on-e-commerce-transactions-section-3931-194o/
- Tips and GST (no ruling; opinions differ): https://bhattandjoshiassociates.com/livestream-donations-and-the-tds-gap-on-creator-income-in-india-why-streamers-and-influencers-have-no-withholding/ ; https://taxguru.in/goods-and-service-tax/social-media-income-gst-income-tax-guide.html

