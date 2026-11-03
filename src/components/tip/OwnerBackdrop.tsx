// A fixed backdrop behind the owner's tip page (rendered next to the form, never inside an
// element that is moved or scaled, so "fixed" stays the whole screen): two slow lime glows, a
// faint grid fading out from the top, rising pressure bubbles, film grain and a vignette. Pure
// CSS, no script; only transform and opacity ever move, and nothing moves under reduced motion.
const BUBBLES = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 7) % 100}%`,
  size: 3 + ((i * 5) % 6),
  delay: `${-((i * 7) % 26)}s`,
  duration: `${22 + ((i * 3) % 14)}s`,
}));

export function OwnerBackdrop() {
  return (
    <div aria-hidden="true" className="ap-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="ap-aurora ap-aurora-a" />
      <div className="ap-aurora ap-aurora-b" />
      <div className="ap-backdrop-grid absolute inset-0" />
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="ap-bubble"
          style={{ left: b.left, width: b.size, height: b.size, animationDelay: b.delay, animationDuration: b.duration }}
        />
      ))}
      <div className="ap-grain absolute inset-0" />
      <div className="ap-vignette absolute inset-0" />
    </div>
  );
}
