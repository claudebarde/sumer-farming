import { describe, expect, it } from "vitest";
import { createInitialFarmPlan } from "../../src/game-core/farm/createInitialFarmPlan";
import { INITIAL_FARM_CONFIG } from "../../src/game-data/initialFarm";

describe("initial farm scenery", () => {
  it("guarantees three rocks and bushes on distinct dry non-arable tiles across seeds", () => {
    const { plotBounds: plot, riverRow, roadRow, worldBounds: world } = INITIAL_FARM_CONFIG;
    for (let seed = 0; seed < 1000; seed++) {
      const { objects } = createInitialFarmPlan(seed);
      const decorations = objects.filter(o => o.type !== "reeds");
      expect(decorations.length).toBeGreaterThanOrEqual(6);
      expect(decorations.length).toBeLessThanOrEqual(8);
      expect(decorations.filter(o => o.type === "rock").length).toBeGreaterThanOrEqual(3);
      expect(decorations.filter(o => o.type === "bush").length).toBeGreaterThanOrEqual(3);
      expect(new Set(objects.map(o => `${o.column}:${o.row}`)).size).toBe(objects.length);
      for (const tile of decorations) {
        expect(tile.row).toBeLessThan(riverRow);
        expect(tile.row).toBeGreaterThanOrEqual(world.minimumRow);
        expect(tile.row).not.toBe(roadRow);
        expect(tile.column).toBeGreaterThanOrEqual(world.minimumColumn);
        expect(tile.column).toBeLessThanOrEqual(world.maximumColumn);
        expect(tile.column >= plot.minimumColumn && tile.column <= plot.maximumColumn &&
          tile.row >= plot.minimumRow && tile.row <= plot.maximumRow).toBe(false);
      }
      expect(objects.filter(o => o.type === "reeds")).toHaveLength(2);
    }
  });
  it("is reproducible for a seed and varies between farms", () => {
    expect(createInitialFarmPlan(42)).toEqual(createInitialFarmPlan(42));
    expect(createInitialFarmPlan(42).objects).not.toEqual(createInitialFarmPlan(43).objects);
  });
});
