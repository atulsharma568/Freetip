import styles from "./HeroHands.module.css";

export function HeroHands() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.stage}>
        <svg
          className={`${styles.hand} ${styles.leftHand}`}
          viewBox="0 0 180 120"
          focusable="false"
        >
          <path
            d="M3 96c18-7 32-15 47-27l39-37c6-6 15-6 21 0 5 5 5 13 0 18L97 63l33-20c7-4 16-2 20 5 3 6 1 13-5 17l-22 14 29-12c8-3 16 1 19 8 2 7-1 14-8 17l-31 13 20-5c8-2 16 3 18 10 2 7-3 14-10 16l-31 8c-14 4-28 6-42 6H35Z"
            fill="var(--color-text)"
            stroke="var(--color-ink)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M4 96 27 86l23 28-13 6H4Z"
            fill="var(--color-muted)"
            stroke="var(--color-ink)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="m84 75 26 15m-12-27 26 14m-10-27 22 12"
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>

        <svg
          className={`${styles.hand} ${styles.rightHand}`}
          viewBox="0 0 180 120"
          focusable="false"
        >
          <g transform="translate(180 0) scale(-1 1)">
            <path
              d="M3 96c18-7 32-15 47-27l39-37c6-6 15-6 21 0 5 5 5 13 0 18L97 63l33-20c7-4 16-2 20 5 3 6 1 13-5 17l-22 14 29-12c8-3 16 1 19 8 2 7-1 14-8 17l-31 13 20-5c8-2 16 3 18 10 2 7-3 14-10 16l-31 8c-14 4-28 6-42 6H35Z"
              fill="var(--color-muted)"
              stroke="var(--color-ink)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M4 96 27 86l23 28-13 6H4Z"
              fill="var(--color-text)"
              stroke="var(--color-ink)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="m84 75 26 15m-12-27 26 14m-10-27 22 12"
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.7"
            />
          </g>
        </svg>

        <svg
          className={styles.note}
          viewBox="0 0 80 52"
          focusable="false"
        >
          <rect
            x="3"
            y="5"
            width="74"
            height="42"
            rx="8"
            fill="var(--color-accent)"
            stroke="var(--color-ink)"
            strokeWidth="3"
          />
          <path
            d="M13 16h20M13 38h20"
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="62" cy="26" r="9" fill="var(--color-ink)" />
          <text
            x="43"
            y="35"
            fill="var(--color-ink)"
            fontFamily="var(--font-mono)"
            fontSize="24"
            fontWeight="700"
            textAnchor="middle"
          >
            ₹
          </text>
        </svg>
      </div>
    </div>
  );
}
