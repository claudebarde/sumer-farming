import { describe, expect, it } from "vitest";
import { buildingOutputTile, isometricMillOutputPosition } from "../../src/client/game/phaser/buildingOutputPlacement";
import { FARM_BUILDING_DEFINITIONS } from "../../src/game-data/buildings";
import { isoPoint } from "../../src/client/game/phaser/isometricProjection";

describe("finished building goods", () => {
  it("lowers isometric mill bags within the lower-left tile regardless of loading side", () => {
    const origin = { column: 3, row: 2 };
    const tile = isoPoint(buildingOutputTile(origin, { rows: 2 }));
    for (const loadingTile of [{ column: 2, row: 2 }, { column: 5, row: 2 }, { column: 3, row: 4 }]) {
      const mill = { ...origin, loadingTile };
      expect(isometricMillOutputPosition(mill)).toEqual({ x: tile.x, y: tile.y + 16 });
    }
  });
  it("projects the mill output onto the lower-left isometric footprint tile", () => {
    const building = { column: 3, row: 2 };
    const centre = isoPoint({ column: 3.5, row: 2.5 });
    const output = isoPoint(buildingOutputTile(building, FARM_BUILDING_DEFINITIONS.mill.footprint));
    expect(output).toEqual({ x: centre.x - 48, y: centre.y });
  });
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
