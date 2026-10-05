import { describe, expect, it } from "vitest";
import { farmBuildingTypes, FARM_BUILDING_DEFINITIONS } from "../../src/game-data/buildings";
import { validateBuildingPlacement } from "../../src/game-core/farm/buildings";

describe("road access required for every building", () => {
  it.each(farmBuildingTypes)("rejects missing, diagonal, unfinished and disconnected roads for %s", building => {
    const row = FARM_BUILDING_DEFINITIONS[building].footprint.rows;
    const context = { building, target: { column: 5, row: 0 }, existingBuildings: [],
      occupiedCoordinates: new Set<string>(), carriedItem: null,
      availableMaterials: { reed: 20, clay: 20, brewingVessels: 20, bakingTools: 20 } };
    const branch = Array.from({ length: 5 - row }, (_, index) => ({ column: 5, row: row + index }));
    expect(validateBuildingPlacement(context).type).toBe("road_access_required");
    expect(validateBuildingPlacement({ ...context, roads: [{ column: 5, row }] }).type).toBe("road_access_required");
    expect(validateBuildingPlacement({ ...context, roads: branch }).type).toBe("valid");
    expect(validateBuildingPlacement({ ...context, roads: branch.map(r => r.row === 4 ? { ...r, completesAt: Date.now() + 60000 } : r) }).type).toBe("road_access_required");
    // A branch along column 4 stops diagonally below the bottom-left tile.
    expect(validateBuildingPlacement({ ...context, roads: branch.map(r => ({ ...r, column: 4 })) }).type).toBe("road_access_required");
    expect(validateBuildingPlacement({ ...context, roads: branch, reservedLoadingTiles: [branch[0]!] }).type).toBe("road_access_required");
  });
});
