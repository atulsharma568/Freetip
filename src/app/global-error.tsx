"use client";

// The last resort: this replaces the whole page, root layout included, so it
// carries its own html and body and cannot rely on the site stylesheet. The
// colours are the DESIGN tokens spelled out (Warm Night, Chalk, Ash, Acid Lime,
// Field Ink); the type falls back to the system face.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#0c0d09",
          color: "#eeefea",
          fontFamily: "system-ui, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <main style={{ maxWidth: 1280, margin: "0 auto", padding: "96px 24px" }}>
          <h1
            style={{
              margin: 0,
              maxWidth: "14ch",
              fontSize: "clamp(2.75rem, 9vw, 5.5rem)",
              fontWeight: 800,
              lineHeight: 0.98,
              letterSpacing: "-0.015em",
              textWrap: "balance",
            }}
          >
            Something broke on our side.
          </h1>
          <p style={{ margin: "24px 0 0", maxWidth: "46ch", fontSize: 18, lineHeight: 1.6, color: "#ababa4" }}>
            Try again in a moment. If it keeps happening, tell us on the contact page.
          </p>
          {error.digest && (
            <p style={{ margin: "16px 0 0", fontSize: 14, color: "#ababa4" }}>
              Reference{" "}
              <span style={{ fontFamily: "ui-monospace, monospace", color: "#eeefea" }}>{error.digest}</span>
            </p>
          )}
          <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 32px" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                height: 56,
                padding: "0 32px",
                border: 0,
                borderRadius: 9999,
                background: "#bfe84a",
                color: "#14180b",
                font: "inherit",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A plain link on purpose: the router may be what broke. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: "#eeefea", fontSize: 16, fontWeight: 500, textUnderlineOffset: 4 }}>
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
