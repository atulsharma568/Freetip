// A fixed backdrop behind the owner's tip page, in the colours of the owner's stream screens
// (rendered next to the form, never inside an element that is moved or scaled, so "fixed" stays
// the whole screen): slow crimson smoke, long red slashes, rising embers, a few drifting blossom
// petals, film grain and a vignette. Pure CSS, no script; only transform and opacity ever move,
// phones get fewer pieces, and nothing moves under reduced motion.
const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37 + 9) % 100}%`,
  size: 3 + ((i * 5) % 4),
  delay: `${-((i * 7) % 24)}s`,
  duration: `${18 + ((i * 3) % 12)}s`,
}));
const PETALS = Array.from({ length: 9 }, (_, i) => ({
  left: `${(i * 23 + 11) % 100}%`,
  delay: `${-((i * 5) % 30)}s`,
  duration: `${26 + ((i * 4) % 14)}s`,
  size: 9 + ((i * 3) % 6),
}));

export function OwnerBackdrop() {
  return (
    <div aria-hidden="true" className="ap-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="ap-smoke ap-smoke-a" />
      <div className="ap-smoke ap-smoke-b" />
      <div className="ap-smoke ap-smoke-c" />
      <div className="ap-slash ap-slash-a" />
      <div className="ap-slash ap-slash-b" />
      <div className="ap-slash ap-slash-c" />
      {EMBERS.map((e, i) => (
        <span
          key={`e${i}`}
          className={`ap-ember ${i % 2 ? "max-sm:hidden" : ""}`}
          style={{ left: e.left, width: e.size, height: e.size, animationDelay: e.delay, animationDuration: e.duration }}
        />
      ))}
      {PETALS.map((p, i) => (
        <span
          key={`p${i}`}
          className={`ap-petal ${i % 2 ? "max-sm:hidden" : ""}`}
          style={{ left: p.left, width: p.size, height: p.size * 0.8, animationDelay: p.delay, animationDuration: p.duration }}
        />
      ))}
      <div className="ap-grain absolute inset-0" />
      <div className="ap-vignette absolute inset-0" />
    </div>
  );
}
