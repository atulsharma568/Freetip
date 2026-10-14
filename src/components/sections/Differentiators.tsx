const QR_MODULES = [
  "11111110101011111",
  "10000010111010001",
  "10111010101010101",
  "10111010011110101",
  "10111011101010101",
  "10000010001010001",
  "11111110101011111",
  "00000000111000000",
  "11010110100101110",
  "00111001011100010",
  "10101111101011001",
  "01110000110100110",
  "11101110111010111",
  "10000100001010001",
  "10110110111011101",
  "10000010100010001",
  "11111110111011111",
] as const;

const SAFETY_STEPS = [
  {
    number: "01",
    title: "Message limit",
    text: "Keep live alerts short and easy to follow.",
  },
  {
    number: "02",
    title: "Word screening",
    text: "Profanity and banned-word checks happen before speech.",
  },
  {
    number: "03",
    title: "Creator approval",
    text: "You decide what gets read out on your stream.",
  },
];

export function Differentiators() {
  return (
    <section
      id="why"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 pb-32 md:pb-48"
    >
      <div className="grid gap-8 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">
            Why Tipsite
          </p>
          <h2 className="display mt-4 max-w-[12ch] text-[clamp(2.5rem,6vw,4.5rem)]">
            Less friction for fans. More control for you.
          </h2>
        </div>
        <p className="max-w-[38ch] text-pretty text-lg text-muted md:col-span-5">
          One tip link built around the way a live stream actually works: quick
          for viewers, visible on screen and careful with what gets spoken.
        </p>
      </div>

      <div className="mt-16 grid gap-4 md:mt-24 md:grid-cols-12 md:grid-rows-[auto_auto]">
        <article className="flex flex-col justify-between rounded-surface border border-line bg-surface p-8 md:col-span-5 md:row-span-2 md:min-h-[31rem] md:p-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">
              For fans
            </p>
            <h3 className="display mt-6 text-[clamp(2.25rem,4vw,3rem)]">
              No account. No email.
            </h3>
            <p className="mt-5 max-w-[31ch] text-pretty text-lg text-muted">
              Open the link, choose an amount and pay with UPI or card. Leave
              the optional name blank to tip anonymously.
            </p>
          </div>
          <ul className="mt-12 space-y-3 text-lg font-medium">
            <li className="flex items-center gap-3">
              <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
              No fan account
            </li>
            <li className="flex items-center gap-3">
              <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
              No email field
            </li>
            <li className="flex items-center gap-3">
              <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
              Anonymous by choice
            </li>
          </ul>
        </article>

        <article className="rounded-surface bg-accent p-8 text-ink md:col-span-7 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.12em]">
            One payment flow
          </p>
          <div className="mt-8 flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div>
              <h3 className="display text-[clamp(2.25rem,4vw,3rem)]">
                UPI + card.
              </h3>
              <p className="mt-4 max-w-[32ch] text-pretty text-lg">
                Both payment options live on the same tip page, so fans pick
                what works without finding a second link.
              </p>
            </div>
            <div
              role="group"
              aria-label="Payment options"
              className="flex shrink-0 gap-2"
            >
              <span className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-accent">
                UPI
              </span>
              <span className="inline-flex h-11 items-center rounded-full border-2 border-ink px-5 text-sm font-semibold">
                Card
              </span>
            </div>
          </div>
        </article>

        <article className="rounded-surface border border-line bg-raised p-8 md:col-span-7 md:p-10">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">
                QR-first sharing
              </p>
              <h3 className="display mt-5 text-[clamp(2.25rem,4vw,3rem)]">
                Keep the link on screen.
              </h3>
              <p className="mt-4 max-w-[31ch] text-pretty text-lg text-muted">
                Put a QR-led tip link on your stream. Viewers can open the same
                page without hunting through chat.
              </p>
            </div>
            <div
              role="img"
              aria-label="Non-scannable sample QR illustration"
              className="shrink-0 self-start rounded-field border border-line bg-ground p-3 sm:self-center"
            >
              <svg
                viewBox="0 0 17 17"
                className="size-32"
                shapeRendering="crispEdges"
                aria-hidden="true"
              >
                <rect width="17" height="17" fill="var(--color-ground)" />
                {QR_MODULES.map((row, y) =>
                  row.split("").map((cell, x) =>
                    cell === "1" ? (
                      <rect
                        key={`${x}-${y}`}
                        x={x}
                        y={y}
                        width="1"
                        height="1"
                        fill="var(--color-accent)"
                      />
                    ) : null,
                  ),
                )}
              </svg>
              <p className="mt-3 max-w-[10rem] text-center text-[0.65rem] font-semibold uppercase leading-tight tracking-[0.1em] text-muted">
                Non-scannable sample QR
              </p>
            </div>
          </div>
        </article>
      </div>

      <article className="mt-4 rounded-surface border border-line bg-surface p-8 md:p-10">
        <div className="grid gap-10 md:grid-cols-12 md:items-end">
          <div className="md:col-span-5">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">
              Safer text-to-speech
            </p>
            <h3 className="display mt-5 text-[clamp(2.25rem,4vw,3rem)]">
              Nothing speaks before you approve it.
            </h3>
            <p className="mt-4 max-w-[34ch] text-pretty text-lg text-muted">
              Messages stay within a limit, get screened for profanity and
              banned words, then wait for your approval before playback.
            </p>
          </div>
          <ol
            aria-label="Text-to-speech safety steps"
            className="grid gap-8 md:col-span-7 md:grid-cols-3 md:gap-5"
          >
            {SAFETY_STEPS.map((step) => (
              <li key={step.number} className="border-t border-line pt-4">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-ink">
                  {step.number}
                </span>
                <h4 className="mt-5 text-lg font-semibold">{step.title}</h4>
                <p className="mt-2 text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </article>
    </section>
  );
}
