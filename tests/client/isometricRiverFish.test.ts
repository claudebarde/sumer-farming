import { describe, expect, it } from "vitest";
import { isometricRiverFish } from "../../src/client/game/phaser/isometricRiverFish";
import { INITIAL_FARM_CONFIG as config } from "../../src/game-data/initialFarm";
import { isoPoint } from "../../src/client/game/phaser/isometricProjection";

describe("isometric ambient fish", () => {
  it("stays within the river with room for its sprite and follows the projection", () => {
    for (let elapsed = 0; elapsed < 300_000; elapsed += 100) {
      const fish = isometricRiverFish(123, elapsed);
      expect(fish.column).toBeGreaterThan(config.worldBounds.minimumColumn + 0.5);
      expect(fish.column).toBeLessThan(config.worldBounds.maximumColumn - 0.5);
      expect(fish.row).toBeGreaterThanOrEqual(config.riverRow - 0.051);
      expect(fish.row).toBeLessThanOrEqual(config.riverRow + 1.051);
      expect({ x: fish.x, y: fish.y }).toEqual(isoPoint(fish));
    }
  });
  it("swims north and south through both rows while continuing east/west roaming", () => {
    const south = isometricRiverFish(123, 3000);
    const north = isometricRiverFish(123, 9000);
    expect(south.row).toBeGreaterThan(config.riverRow + 1);
    expect(north.row).toBeLessThan(config.riverRow);
    expect(south.column).not.toBe(north.column);
    expect(isometricRiverFish(123, 15_000).row).toBeCloseTo(south.row);
  });
  it("preserves position when redrawn or paused and swims without jumps", () => {
    for (let elapsed = 0; elapsed < 60_000; elapsed += 16) {
      const current = isometricRiverFish(12, elapsed);
      const next = isometricRiverFish(12, elapsed + 16);
      expect(isometricRiverFish(12, elapsed)).toEqual(current);
      expect(Math.hypot(next.x - current.x, next.y - current.y)).toBeLessThan(3);
    }
  });
});
