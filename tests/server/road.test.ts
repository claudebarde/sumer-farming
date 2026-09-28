import { describe, expect, it } from "vitest";
import { createInitialFarmPlan } from "../../src/game-core/farm/createInitialFarmPlan";
import { isInsideArablePlot, validateCultivation } from "../../src/game-core/farm/cultivation";
import { validateBuildingPlacement } from "../../src/game-core/farm/buildings";
import { getRiverConnectedCanals, validateIrrigationLocation } from "../../src/game-core/farm/irrigation";

describe("road row", () => {
  it("never places scenery on the road in new games", () => {
    for (let seed = 0; seed < 1000; seed++) {
      expect(createInitialFarmPlan(seed).objects.every(object => object.row !== 5)).toBe(true);
    }
  });
  it("reserves all eight road tiles rather than allowing planting or drops", () => {
    for (let column = 0; column < 8; column++) {
      expect(isInsideArablePlot({ column, row: 5 })).toBe(false);
      expect(validateCultivation({ target: { column, row: 5 }, crop: "barley", carriedItem: "barley",
        occupiedCoordinates: [], activeCanals: [] })).toEqual({ type: "outside_arable_plot" });
    }
    expect(isInsideArablePlot({ column: 2, row: 4 })).toBe(true);
    expect(isInsideArablePlot({ column: 2, row: 6 })).toBe(true);
  });
  it.each([4, 5])("rejects a building overlapping the road from row %i", row => {
    expect(validateBuildingPlacement({ building: "granary", existingBuildings: [], target: { column: 1, row },
      occupiedCoordinates: new Set(), carriedItem: null, availableMaterials: { reed: 100, clay: 100 } }))
      .toEqual({ type: "outside_arable_plot" });
  });
  it("keeps canals connected beneath the road and irrigates land above it", () => {
    const canals = Array.from({ length: 6 }, (_, i) => ({ column: 2, row: 9 - i }));
    expect(validateIrrigationLocation({ column: 2, row: 5 })).toEqual({ type: "valid" });
    expect(getRiverConnectedCanals(canals)).toHaveLength(6);
    expect(validateCultivation({ target: { column: 3, row: 4 }, crop: "barley", carriedItem: "barley",
      occupiedCoordinates: [], activeCanals: canals })).toEqual({ type: "valid" });
  });
});
