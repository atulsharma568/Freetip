// When a tip page may start moving pictures (page builder phase 3). A picture or poster is always
// drawn first, in the served page. Only after the page has loaded, and only if none of these say
// no, does a GIF or video take its place. Pure, so each rule is tested on its own.

export interface MotionEnv {
  // The fan asked their device for less motion.
  reducedMotion: boolean;
  // The browser is in data-saver mode.
  saveData: boolean;
  // The connection type the browser reports ("slow-2g", "2g", "3g", "4g"), or null when it does not say.
  effectiveType: string | null;
  // The device's memory in GB as the browser rounds it, or null when it does not say.
  deviceMemory: number | null;
}

const SLOW = ["slow-2g", "2g", "3g"];

// A browser that does not report something (Safari has no connection or memory report) is not held
// back for it: only a known "no" stops the motion.
export function mayPlayMotion(env: MotionEnv): boolean {
  if (env.reducedMotion || env.saveData) return false;
  if (env.effectiveType !== null && SLOW.includes(env.effectiveType)) return false;
  if (env.deviceMemory !== null && env.deviceMemory <= 2) return false;
  return true;
}

// The parts of a browser window this reads, so a test can hand in a made-up one.
export interface MotionWindow {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
}

export function readMotionEnv(win: MotionWindow): MotionEnv {
  const connection = win.navigator?.connection;
  const memory = win.navigator?.deviceMemory;
  return {
    reducedMotion: win.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
    saveData: connection?.saveData === true,
    effectiveType: typeof connection?.effectiveType === "string" ? connection.effectiveType : null,
    deviceMemory: typeof memory === "number" && Number.isFinite(memory) ? memory : null,
  };
}
