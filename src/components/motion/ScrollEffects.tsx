// A lime progress line along the top edge and a soft blur that fades in under
// the nav, so content slides away from the nav instead of cutting off behind
// it. Both are pure CSS (no scroll listeners) and decorative.
export function ScrollEffects() {
  return (
    <>
      <div aria-hidden="true" className="scroll-progress" />
      <div aria-hidden="true" className="nav-blur" />
    </>
  );
}
