import { describe, expect, it } from "vitest";
import { INITIAL_FARM_CONFIG } from "../../src/game-data/initialFarm";
import { PROGRESSION_SIGNPOST } from "../../src/game-data/progression";
import { validateIrrigationLocation } from "../../src/game-core/farm/irrigation";
import { findLoadingTile } from "../../src/game-core/farm/roads";
import { getBuildingFootprint, validateBuildingPlacement, describeBuildingPlacementRule, isInsideBuildingPlot } from "../../src/game-core/farm/buildings";
import { preservesBuildingAccess } from "../../src/game-core/farm/buildingAccess";

describe("roadside farm layout", () => {
  it.each([{ column: -1, row: 1 }, { column: 7, row: 1 }, { column: 3, row: -1 }, { column: 3, row: 8 }, { column: 8, row: 2 }])(
    "rejects an oven crossing the plot edge at $column,$row even beside a road", target => {
      expect(getBuildingFootprint("breadOven", target).some(p => !isInsideBuildingPlot(p))).toBe(true);
      expect(validateBuildingPlacement({ building: "breadOven", target, existingBuildings: [], occupiedCoordinates: new Set(),
        carriedItem: null, availableMaterials: { reed: 4, clay: 6, bakingTools: 2 }, roads: [{ column: target.column - 1, row: target.row }] })).toEqual({ type: "outside_arable_plot" });
    }
  );
  it("identifies the screenshot's farm overlap and permits a genuinely empty roadside oven", () => {
    const context = { building: "breadOven" as const, existingBuildings: [], occupiedCoordinates: new Set<string>(),
      carriedItem: null, availableMaterials: { reed: 4, clay: 6, bakingTools: 2 },
      roads: [{ column: -1, row: 2 }, { column: -1, row: 3 }] };
    const blocked = validateBuildingPlacement({ ...context, target: { column: 0, row: 2 } });
    expect(blocked).toEqual({ type: "footprint_occupied", occupant: "farm" });
    if (blocked.type !== "valid") expect(describeBuildingPlacementRule(blocked)).toContain("Farm's 2×2 footprint");
    expect(validateBuildingPlacement({ ...context, roads: [{ column: -1, row: 1 }], target: { column: 0, row: 1 } }).type).toBe("valid");
  });
  it("places the farm immediately right of the signpost, above the road", () => {
    const { buildingBounds: b, roadRow, farmerSpawn } = INITIAL_FARM_CONFIG;
    expect(b.minimumColumn).toBe(PROGRESSION_SIGNPOST.column + 1);
    expect(b.maximumRow).toBe(PROGRESSION_SIGNPOST.row);
    expect(b.maximumRow + 1).toBe(roadRow);
    expect(farmerSpawn).toEqual({ column: b.minimumColumn, row: roadRow });
  });
  it("protects the farm footprint and entrance from irrigation and other loading points", () => {
    const { buildingBounds: b, farmerSpawn } = INITIAL_FARM_CONFIG;
    for (const p of [...getBuildingFootprint("granary", { column: b.minimumColumn, row: b.minimumRow }), farmerSpawn]) {
      expect(validateIrrigationLocation(p).type).toBe("reserved_tile");
    }
    const candidate = findLoadingTile(getBuildingFootprint("granary", { column: 1, row: 6 }), [], [], new Set());
    expect(candidate).toEqual({ column: 2, row: 5 });
  });
  it("keeps the relocated mill and granary accessible", () => {
    expect(preservesBuildingAccess({ buildings: [{ type: "mill", column: 3, row: 3 }, { type: "granary", column: 5, row: 3 }] })).toBe(true);
  });
});
