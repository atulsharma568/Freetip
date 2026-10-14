"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";

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
    a: "We take 5% of every tip. Razorpay's payment charge (2% plus 18% GST on that charge, at its standard rate) also comes out of your payout. On a ₹100 tip you get ₹92.64. Fans pay exactly the amount they choose, with nothing added. International cards cost more.",
  },
  {
    q: "How do I get paid?",
    a: "Payouts go to your bank account in INR. Payout timing will be published at launch.",
  },
  {
    q: "How do tips show up on my stream?",
    a: "You get an alert link to add to OBS as a browser source. Each tip then shows the fan's name, the amount and their message on stream.",
  },
  {
    q: "When does text-to-speech play?",
    a: "Only messages within the message limit that pass profanity and banned-word screening can be read out. With approve-first on, which is the default, each one also waits for your okay. You can turn approve-first, text-to-speech or on-stream alerts off.",
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
    a: "Not yet. This page previews the product. The sample tip card and the sample alert are demos, not connected to payments or to a stream.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="mx-auto grid max-w-7xl scroll-mt-24 gap-x-8 gap-y-12 px-6 pb-32 md:grid-cols-12 md:pb-48"
    >
      <h2 className="display self-start text-[clamp(2.5rem,6vw,4.5rem)] md:sticky md:top-28 md:col-span-5">
        Common questions
      </h2>
      <ul className="divide-y divide-line md:col-span-7">
        {ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <li key={item.q}>
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
                    className={`size-6 shrink-0 transition-transform duration-500 ease-out-expo ${isOpen ? "rotate-45" : ""}`}
                  />
                </button>
              </h3>
              <div
                id={`faq-a-${i}`}
                role="region"
                aria-labelledby={`faq-q-${i}`}
                className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out-expo ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="overflow-hidden">
                  <p className="max-w-[56ch] text-pretty pb-6 text-lg text-muted">
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
