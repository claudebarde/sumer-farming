import { describe, expect, it } from "vitest";
import { validateBuildingPlacement } from "../../src/game-core/farm/buildings";
import { validateCultivation } from "../../src/game-core/farm/cultivation";
import { validateIrrigationLocation } from "../../src/game-core/farm/irrigation";
import { PROGRESSION_SIGNPOST } from "../../src/game-data/progression";

describe("reserved level signpost tile", () => {
  it.each(["granary", "brewery"] as const)("blocks every %s footprint overlapping the signpost", building => {
    for (const column of [-1, 0]) for (const row of [3, 4]) {
      expect(validateBuildingPlacement({ building, existingBuildings: [], target: { column, row },
        occupiedCoordinates: new Set(), carriedItem: null,
        availableMaterials: { reed: 100, clay: 100, brewingVessels: 2 } }))
        .toEqual({ type: "footprint_occupied" });
    }
    expect(validateBuildingPlacement({ building, existingBuildings: [], target: { column: 3, row: 3 },
      occupiedCoordinates: new Set(), carriedItem: null,
      availableMaterials: { reed: 100, clay: 100, brewingVessels: 2 } })).toEqual({ type: "valid" });
  });

  it("blocks fields and irrigation on the signpost", () => {
    expect(validateCultivation({ target: PROGRESSION_SIGNPOST, crop: "barley", carriedItem: "barley",
      occupiedCoordinates: [], activeCanals: [] })).toEqual({ type: "outside_arable_plot" });
    expect(validateIrrigationLocation(PROGRESSION_SIGNPOST)).toEqual({ type: "reserved_tile" });
    expect(validateIrrigationLocation({ column: 3, row: 4 })).toEqual({ type: "valid" });
  });
});
