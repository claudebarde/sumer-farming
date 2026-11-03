import { isoPoint, type IsoCell } from "./isometricProjection";

/** Screen-space clearance includes lowered heads, not just ground positions. */
export const gazellesTooClose = (a: IsoCell, b: IsoCell) => {
  const p = isoPoint(a), q = isoPoint(b);
  return ((p.x-q.x)/70)**2 + ((p.y-q.y)/52)**2 < 1;
};

// Discrete registered artwork, with no crossfades or transparent ghost poses.
export const gazelleGrazePose = (elapsed: number, rest: number) => {
  const time = Math.max(0, elapsed), lowerDuration = 1120;
  if (time >= rest) return { kind: "lower", index: 0 } as const;
  if (time < lowerDuration) return { kind: "lower", index: Math.min(7, Math.floor(time / 140)) } as const;
  if (time >= rest - lowerDuration) return { kind: "lower", index: Math.max(0, 7 - Math.floor((time - (rest - lowerDuration)) / 140)) } as const;
  return { kind: "chew", index: Math.floor((time - lowerDuration) / 220) % 4 } as const;
};
