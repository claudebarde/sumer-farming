export type GazelleVisit = { phase: "away" | "entering" | "visiting" | "exiting"; elapsed: number; duration: number };
const between = (min: number, max: number, random: () => number) => min + random() * (max - min);

export const initialGazelleVisit = (random: () => number): GazelleVisit => ({
  phase: "away", elapsed: 0, duration: between(5000, 15000, random),
});

/** Cosmetic, visible-scene time only: never catch up through missed visits. */
export const advanceGazelleVisit = (visit: GazelleVisit, delta: number, random: () => number): GazelleVisit => {
  const elapsed = visit.elapsed + Math.max(0, Math.min(delta, 80));
  if (elapsed < visit.duration) return { ...visit, elapsed };
  switch (visit.phase) {
    case "away": return { phase: "entering", elapsed: 0, duration: 8000 };
    case "entering": return { phase: "visiting", elapsed: 0, duration: between(60000, 120000, random) };
    case "visiting": return { phase: "exiting", elapsed: 0, duration: 8000 };
    case "exiting": return { phase: "away", elapsed: 0, duration: between(60000, 180000, random) };
  }
};

/** Reduced-motion fallback keeps stationary animals with gentle fades. */
export const gazelleVisitAlpha = (visit: GazelleVisit) => {
  switch (visit.phase) {
    case "away": return 0;
    case "entering": return Math.min(1,visit.elapsed/1500);
    case "visiting": return 1;
    case "exiting": return Math.max(0,1-visit.elapsed/1500);
  }
};
