// A fixed, quiet backdrop behind the creator dashboard and the owner console, in the site's own
// near-black and lime: a faint dot grid, two soft lime glows, film grain and a vignette. Pure CSS,
// nothing moves, so it costs no script and has nothing to switch off under reduced motion.
export function AppBackdrop() {
  return (
    <div aria-hidden="true" className="app-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="app-glow app-glow-a" />
      <div className="app-glow app-glow-b" />
      <div className="app-dots absolute inset-0" />
      <div className="app-grain absolute inset-0" />
      <div className="app-vignette absolute inset-0" />
    </div>
  );
}
