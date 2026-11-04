"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { RevealHeading } from "@/components/motion/RevealHeading";
import { FEES } from "@/lib/legal";
import { LIVE_SALES_OPEN } from "@/lib/pricing";

// What the plan sentences say follows LIVE_SALES_OPEN, so opening sales needs no edit here.
const PLANS_SENTENCE = LIVE_SALES_OPEN
  ? "The price is shown in your dashboard before you pay."
  : "Plans are not open yet, and the price will be announced when they open.";
const PLANS_LIVE_CLAUSE = LIVE_SALES_OPEN ? "" : " and the paid plans cannot be bought yet";

const ITEMS = [
  {
    q: "Do fans need an account or email?",
    a: "No. A fan opens your link, picks an amount and pays with UPI or card. Name is optional, so they can leave it blank and tip anonymously.",
  },
  {
    q: "Can fans pay by card?",
    a: "Yes. UPI and card sit in the same tip flow, so a fan who doesn't use UPI can still tip.",
  },
  {
    q: "What does it cost?",
    a: `We take ${FEES.platformPercent}% of every tip, plus a ${FEES.gatewayPercent}% payment processing fee, both out of your payout. Fans pay exactly the amount they choose, with nothing added. Creators can also buy an optional paid plan, Starter or Creator, for extra features. A plan is an extra only: it does not change the fee on tips. ${PLANS_SENTENCE}`,
  },
  {
    q: "Is there an extra charge on large tips?",
    a: "No. Nothing extra is added to a large tip today. There has been an announcement about a possible UPI fee on merchant payments above ₹2,000, and as far as we know it has not started. If any extra charge ever applies, we will tell creators beforehand.",
  },
  {
    q: "How do I get paid?",
    a: "Payouts go to the bank account or UPI ID you register, in INR. Each payout shows in your dashboard. A payout can be delayed by bank holidays, verification checks, or a hold while we look into fraud or a chargeback.",
  },
  {
    q: "Can a tip be refunded?",
    a: "No. Tips are final once paid. We only put right payment errors, such as being charged twice or money taken for a payment that failed.",
  },
  {
    q: "How do tips show up on my stream?",
    a: "You get an alert link to add to OBS as a browser source. Each tip then shows the fan's name, the amount and their message on stream.",
  },
  {
    q: "When does text-to-speech play?",
    a: "Only messages within the message limit that pass your banned-word check can be read out. With approve-first on, which is the default, each one also waits for your okay. You can turn approve-first, text-to-speech or on-stream alerts off.",
  },
  {
    q: "What is the QR code for?",
    a: "Your page gets a QR code you can show on stream. Viewers scan it with their phone and land straight on your tip page.",
  },
  {
    q: "How is this different from Super Chat?",
    a: "Super Chat happens inside YouTube. Tips here come through your own link, which you can share anywhere.",
  },
  {
    q: "Is it live yet?",
    a: `Partly. Creators can sign in with Google now and set up their tip page, OBS alert, text-to-speech and dashboard. Payouts to creators have not started yet${PLANS_LIVE_CLAUSE}. The sample tip card and the sample alert on this page are demos, not connected to payments or to a stream.`,
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="mx-auto grid max-w-7xl scroll-mt-24 gap-x-8 gap-y-12 px-6 pb-32 md:grid-cols-12 md:pb-48"
    >
      <RevealHeading className="display self-start text-[clamp(2.5rem,6vw,4.5rem)] md:sticky md:top-28 md:col-span-5">
        Common questions
      </RevealHeading>
      <ul className="divide-y divide-line md:col-span-7">
        {ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <li key={item.q} className="group relative">
              <h3>
                <button
                  type="button"
                  id={`faq-q-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-a-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left text-xl font-semibold transition-colors duration-200 hover:text-accent md:text-2xl"
                >
                  {item.q}
                  <Plus
                    aria-hidden="true"
                    weight="bold"
                    className={`size-6 shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${isOpen ? "rotate-45" : ""}`}
                  />
                </button>
              </h3>
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-0 top-0 h-px origin-left bg-accent transition-transform duration-500 ease-out-expo motion-reduce:transition-none group-hover:scale-x-100 ${isOpen ? "scale-x-100" : "scale-x-0"}`}
              />
              <div
                id={`faq-a-${i}`}
                role="region"
                aria-labelledby={`faq-q-${i}`}
                className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out-expo ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="overflow-hidden">
                  <p
                    className={`max-w-[56ch] text-pretty pb-6 text-lg text-muted transition-[transform,opacity] duration-500 delay-75 ease-out-expo motion-reduce:transition-none ${isOpen ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
                  >
                    {item.a}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
