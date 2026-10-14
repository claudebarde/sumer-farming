import { expect, it } from "vitest";
import { fishingTexture } from "../../src/client/game/phaser/farmerFishing";
import { blendRiverFish, fishingAreaFish, fishingAim } from "../../src/client/game/phaser/isometricRiverFish";
import { fishPosition, catchesFish } from "../../src/game-core/farm/fishing";

it("casts once after arrival, preserving idle on reload and reduced motion", () => {
  expect(fishingTexture(-1)).toBe("fishing-idle");
  expect([0, 250, 550, 750, 1100].map(t => fishingTexture(t))).toEqual([
    "fishing-lift", "fishing-backswing", "fishing-forward", "fishing-follow-through", "fishing-idle"]);
  expect(fishingTexture(100_000)).toBe("fishing-idle");
  expect(fishingTexture(null)).toBe("fishing-idle");
  expect(fishingTexture(300, true)).toBe("fishing-idle");
});
it("joins the selected fishing area continuously without leaving the river", () => {
  const session = { id: "test", seed: 123, startedAt: 0, lastCastAt: null, column: 11, row: 10 };
  const from = { column: -2, row: 11 };
  const target = fishingAreaFish(session, 0);
  expect(blendRiverFish(from, target, 0, 4000)).toEqual(from);
  expect(blendRiverFish(from, target, 4000, 4000)).toEqual(target);
  for (let t = 0; t < 60_000; t += 100) {
    const fish = fishingAreaFish(session, t);
    expect(fish.column).toBeLessThan(11);
    expect(fish.column).toBeGreaterThan(7.5);
    expect(fish.row).toBeGreaterThan(10);
    expect(fish.row).toBeLessThan(11);
  }
});
it("maps rendered fish and clicked columns to the server's seeded catch coordinates", () => {
  for (const column of [-4, 2, 11]) {
    const session = { id: "test", seed: 456, startedAt: 0, lastCastAt: null, column, row: 10 };
    for (let t = 0; t < 5000; t += 50) {
      const fish = fishingAreaFish(session, t);
      const aim = fishingAim(fish.column, column)!;
      expect(aim).toBeCloseTo(fishPosition(session.seed, t));
      expect(catchesFish(session.seed, t, aim)).toBe(true);
    }
  }
  expect(fishingAim(-100, 2)).toBeNull();
});
