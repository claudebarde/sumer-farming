import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { breweryOrientationTexture } from "../../src/client/game/phaser/breweryOrientation";
import { getBuildingFootprint } from "../../src/game-core/farm/buildings";
import { breweryLoadingCorner, findLoadingTile } from "../../src/game-core/farm/roads";

it("removes the temporary control while keeping orientation selection in real placement", () => {
  const scene = readFileSync(new URL("../../src/client/game/phaser/scenes/IsometricFarmScene.ts", import.meta.url), "utf8");
  expect(scene).not.toContain("beginBreweryOrientationPreview");
  expect(scene).toContain('breweryOrientationTexture({ ...this.mockPlacement, loadingTile: preview.loading }');
  const ui = readFileSync(new URL("../../src/client/components/IsometricFarm.tsx", import.meta.url), "utf8");
  expect(ui).not.toContain('"Test brewery"');
  expect(ui).not.toContain('"Preview brewery orientation"');
  expect(ui).not.toContain("breweryPreview");
  expect(ui).toContain("[placingBuilding]");
});

it("shares the original-orientation loading preference with construction, excluding unusable roads", () => {
  const origin = { column: 3, row: 1 };
  const footprint = getBuildingFootprint("brewery", origin);
  const roads = [2, 5].flatMap(column => [1, 2, 3, 4].map(row => ({ column, row })));
  const choose = (reserved: { column: number; row: number }[], occupied: Set<string>) =>
    findLoadingTile(footprint, roads, reserved, occupied, { building: "brewery", now: 1000 });
  const preferred = choose([], new Set())!;
  expect(breweryLoadingCorner(origin, preferred)).toBe("B");
  expect(breweryOrientationTexture({ ...origin, loadingTile: preferred }, roads, 1000)).toBe("brewery-left-bottom");
  const reserved = [{ column: 2, row: 1 }, { column: 2, row: 2 }];
  expect(breweryLoadingCorner(origin, choose(reserved, new Set())!)).toBe("C");
  expect(breweryLoadingCorner(origin, choose([], new Set(["2:1", "2:2"]))!)).toBe("C");
  const service = readFileSync(new URL("../../src/server/services/buildFarmBuilding.ts", import.meta.url), "utf8");
  expect(service).toContain("occupiedCoordinates, { building: buildingType }");
  const placement = readFileSync(new URL("../../src/client/game/phaser/isometricBuildingPlacement.ts", import.meta.url), "utf8");
  expect(placement).toContain("occupied, { building: type, now }");
});

it("switches shells across the main road using the B/C output rule", () => {
  expect(breweryOrientationTexture({ column: 3, row: 3 }, [], 1000)).toBe("brewery-left-bottom");
  expect(breweryOrientationTexture({ column: 3, row: 6 }, [], 1000)).toBe("brewery-right-top");
});

it("falls back to the B-facing shell without a connected adjacent road", () => {
  expect(breweryOrientationTexture({ column: 3, row: 0 }, [], 1000)).toBe("brewery-left-bottom");
});

it("follows connected side roads rather than simply checking the main-road side", () => {
  const building = { column: 3, row: 1 };
  const rightRoad = [1, 2, 3, 4].map(row => ({ column: 5, row }));
  const leftRoad = [1, 2, 3, 4].map(row => ({ column: 2, row }));
  expect(breweryOrientationTexture(building, rightRoad, 1000)).toBe("brewery-right-top");
  expect(breweryOrientationTexture(building, leftRoad, 1000)).toBe("brewery-left-bottom");
  expect(breweryOrientationTexture(building, [...leftRoad, ...rightRoad], 1000)).toBe("brewery-left-bottom");
  expect(breweryOrientationTexture({ ...building, loadingTile: { column: 5, row: 1 } }, [...leftRoad, ...rightRoad], 1000)).toBe("brewery-right-top");
  expect(breweryOrientationTexture(building, rightRoad.map(road => ({ ...road, completesAt: 2000 })), 1000)).toBe("brewery-left-bottom");
});
