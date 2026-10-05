import { describe, expect, it } from "vitest";
import { buildingOutputTile } from "../../src/client/game/phaser/buildingOutputPlacement";
import { FARM_BUILDING_DEFINITIONS } from "../../src/game-data/buildings";

describe("finished building goods", () => {
  it.each(["mill", "breadOven", "brewery"] as const)("places %s output inside its bottom-left tile", type => {
    const building = { column: 3, row: 2 };
    expect(buildingOutputTile(building, FARM_BUILDING_DEFINITIONS[type].footprint))
      .toEqual({ column: 3, row: 3 });
    expect(building).toEqual({ column: 3, row: 2 });
  });

  it("supports a translated scene position without using surrounding road tiles", () => {
    expect(buildingOutputTile({ column: 12, row: 8 }, { rows: 2 }))
      .toEqual({ column: 12, row: 9 });
  });
});
