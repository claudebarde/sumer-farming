import { describe, expect, it } from "vitest";
import { riverRipples } from "../../src/client/game/phaser/riverRipples";

describe("calm river ripples", () => {
  it("keeps sparse faint waves within the river diamond, including stroke width", () => {
    for (let column = -4; column <= 11; column++) for (let time = 0; time < 30000; time += 137) {
      const waves = riverRipples(column, time);
      expect(waves).toHaveLength(2);
      for (const wave of waves) {
        expect(wave.alpha).toBeGreaterThanOrEqual(0);
        expect(wave.alpha).toBeLessThanOrEqual(0.7);
        for (const point of wave.points) expect((Math.abs(point.x) + 1) / 48 + (Math.abs(point.y) + 1) / 24).toBeLessThan(1);
      }
    }
  });
  it("is deterministic across redraws and varies between neighbouring tiles", () => {
    expect(riverRipples(3, 1234)).toEqual(riverRipples(3, 1234));
    expect(riverRipples(3, 1234)).not.toEqual(riverRipples(4, 1234));
    expect(riverRipples(3, 1234)).not.toEqual(riverRipples(3, 2234));
  });
  it("keeps a static surface with reduced motion", () => {
    expect(riverRipples(3, 0, true)).toEqual(riverRipples(3, 100000, true));
  });
  it("recycles only when invisible rather than travelling backwards", () => {
    const period = 8000 / 1.5;
    expect(riverRipples(0, period - 1)[0]!.alpha).toBeLessThan(0.00001);
    expect(riverRipples(0, period + 1)[0]!.alpha).toBeLessThan(0.00001);
  });
  it("travels left to right at 150% of the previous average speed", () => {
    const before = riverRipples(0, 1000)[0]!.points[0]!;
    const after = riverRipples(0, 2000)[0]!.points[0]!;
    expect(after.x - before.x).toBeCloseTo(16 / 8000 * 1.5 * 1000);
    expect(after.y).toBe(before.y);
  });
});
