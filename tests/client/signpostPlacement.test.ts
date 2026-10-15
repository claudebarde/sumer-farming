import { describe, expect, it } from "vitest";
import { validateBuildingPlacement } from "../../src/game-core/farm/buildings";
import { validateCultivation } from "../../src/game-core/farm/cultivation";
import { validateIrrigationLocation } from "../../src/game-core/farm/irrigation";
import { PROGRESSION_SIGNPOST } from "../../src/game-data/progression";
import { validateRoadPlacement } from "../../src/game-core/farm/roads";

describe("former level signpost tile", () => {
  it.each(["granary", "brewery"] as const)("uses ordinary %s footprint rules", building => {
    for (const column of [-1, 0]) for (const row of [3, 4]) {
      expect(validateBuildingPlacement({ building, existingBuildings: [], target: { column, row },
        occupiedCoordinates: new Set(), carriedItem: null,
        availableMaterials: { reed: 100, clay: 100, brewingVessels: 2 } }))
        .toMatchObject({ type: row === 4 ? "outside_building_ground" : column === 0 ? "footprint_occupied" : "valid" });
    }
    expect(validateBuildingPlacement({ building, existingBuildings: [], target: { column: 3, row: 3 },
      occupiedCoordinates: new Set(), carriedItem: null,
      availableMaterials: { reed: 100, clay: 100, brewingVessels: 2 } })).toEqual({ type: "valid" });
  });

  it("allows roads and irrigation but remains non-arable", () => {
    expect(validateRoadPlacement(PROGRESSION_SIGNPOST, [], new Set())).toBeNull();
    expect(validateCultivation({ target: PROGRESSION_SIGNPOST, crop: "barley", carriedItem: "barley",
      occupiedCoordinates: [], activeCanals: [] })).toEqual({ type: "outside_arable_plot" });
    expect(validateIrrigationLocation(PROGRESSION_SIGNPOST)).toEqual({ type: "valid" });
    expect(validateIrrigationLocation({ column: 3, row: 4 })).toEqual({ type: "valid" });
  });
});
