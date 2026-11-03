import { describe, expect, it } from "vitest";
import { initialGazelleVisit, advanceGazelleVisit, gazelleVisitAlpha } from "../../src/client/game/phaser/gazelleVisits";

describe("decorative gazelle visits", () => {
  it("varies first arrival, visit length and quiet intervals", () => {
    for (const value of [0, .5, .999]) {
      const random = () => value;
      const initial = initialGazelleVisit(random);
      expect(initial.duration).toBeGreaterThanOrEqual(5000);
      expect(initial.duration).toBeLessThanOrEqual(15000);
      const entry = advanceGazelleVisit({ ...initial, elapsed: initial.duration }, 40, random);
      expect(entry.phase).toBe("entering");
      const visit = advanceGazelleVisit({ ...entry, elapsed: entry.duration }, 40, random);
      expect(visit.phase).toBe("visiting");
      expect(visit.duration).toBeGreaterThanOrEqual(60000);
      expect(visit.duration).toBeLessThanOrEqual(120000);
      const exit = advanceGazelleVisit({ ...visit, elapsed: visit.duration }, 40, random);
      expect(exit.phase).toBe("exiting");
      const away = advanceGazelleVisit({ ...exit, elapsed: exit.duration }, 40, random);
      expect(away.phase).toBe("away");
      expect(away.duration).toBeGreaterThanOrEqual(60000);
      expect(away.duration).toBeLessThanOrEqual(180000);
    }
  });
  it("does not replay elapsed visits after a stalled frame", () => {
    const initial = initialGazelleVisit(() => 0);
    expect(advanceGazelleVisit(initial, 3600000, () => 0)).toEqual({ ...initial, elapsed: 80 });
  });
  it("keeps the herd opaque throughout grazing and fades reduced-motion transitions", () => {
    expect(gazelleVisitAlpha({phase:"visiting",duration:60000,elapsed:0})).toBe(1);
    expect(gazelleVisitAlpha({phase:"visiting",duration:60000,elapsed:60000})).toBe(1);
    expect(gazelleVisitAlpha({phase:"entering",duration:8000,elapsed:750})).toBe(.5);
    expect(gazelleVisitAlpha({phase:"exiting",duration:8000,elapsed:750})).toBe(.5);
    expect(gazelleVisitAlpha(initialGazelleVisit(() => 0))).toBe(0);
  });
});
