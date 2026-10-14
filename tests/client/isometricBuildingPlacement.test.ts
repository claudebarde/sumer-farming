import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { mockGranaryPlacement, granaryBuildBlocker, granaryPlacement, buildingBuildBlocker, buildingPlacement } from "../../src/client/game/phaser/isometricBuildingPlacement";

const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null },
    carriedItem: { itemKey: "barley", quantity: 2, expiresAt: null }, gathering: null },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
const farmer = { column: 1, row: 5 };
const target = { column: 4, row: 3 };

it("enables mill placement at level 5 with dropped materials and empty hands", () => {
  const s = snapshot();
  expect(buildingBuildBlocker(s, 1000, "mill")).toBe("Unlock at level 5");
  s.farm.progression = { level: 5, breadSold: 0, barleySold: 0, beerSold: 0, requestsDelivered: 0,
    stats: { breadProduced: 0, processedBarley: 0, harvestedBarley: 0, harvests: 0, beerProduced: 0, fishFed: 0 } };
  expect(buildingBuildBlocker(s, 1000, "mill")).toContain("hands");
  s.farm.carriedItem = null;
  s.inventory = [{ itemKey: "reed", quantity: 2 }, { itemKey: "clay", quantity: 3 }];
  expect(buildingBuildBlocker(s, 1000, "mill")).toContain("4 clay");
  s.groundItems = [{ id, itemKey: "clay", quantity: 1, expiresAt: null, column: 8, row: 2 }];
  expect(buildingBuildBlocker(s, 1000, "mill")).toBeNull();
  expect(buildingPlacement(s, target, farmer, 1000, "mill")).toMatchObject({ rule: { type: "valid" }, loading: { column: 4, row: 5 } });
  expect(buildingPlacement(s, target, target, 1000, "mill").rule.type).toBe("footprint_occupied");
  expect(buildingPlacement(s, { column: 4, row: 0 }, farmer, 1000, "mill").rule.type).toBe("road_access_required");
});

it("enforces economic and level gates for real construction", () => {
  const s = snapshot();
  expect(granaryBuildBlocker(s, Date.now())).toBe("Unlock at level 2");
  s.farm.progression = { level: 3, breadSold: 0, barleySold: 0, beerSold: 0, requestsDelivered: 0,
    stats: { breadProduced: 0, processedBarley: 0, harvestedBarley: 0, harvests: 0, beerProduced: 0, fishFed: 0 } };
  expect(granaryBuildBlocker(s, Date.now())).toContain("hands");
  s.farm.carriedItem = null;
  expect(granaryBuildBlocker(s, Date.now())).toContain("Gather");
  s.inventory = [{ itemKey: "reed", quantity: 2 }, { itemKey: "clay", quantity: 3 }];
  expect(granaryBuildBlocker(s, Date.now())).toBeNull();
  expect(granaryPlacement(s, target, farmer, Date.now()).rule.type).toBe("valid");
});

it("previews valid road-adjacent space without requiring materials or empty hands and without mutating a save", () => {
  const s = snapshot(), before = JSON.stringify(s);
  const result = mockGranaryPlacement(s, target, farmer, Date.now());
  expect(result.rule.type).toBe("valid");
  expect(result.footprint).toHaveLength(4);
  expect(result.loading).toEqual({ column: 4, row: 5 });
  expect(JSON.stringify(s)).toBe(before);
});

it.each([
  [{ column: 7, row: 6 }, "outside_building_ground"],
  [{ column: 4, row: 10 }, "outside_building_ground"],
  [{ column: 1, row: 3 }, "footprint_occupied"],
  [{ column: 4, row: 5 }, "outside_building_ground"],
  [{ column: 4, row: 0 }, "road_access_required"]
] as const)("rejects invalid geometry at %j", (cell, type) => {
  expect(mockGranaryPlacement(snapshot(), cell, farmer, Date.now()).rule.type).toBe(type);
});

it("rejects ground items and the farmer in the footprint", () => {
  const s = snapshot();
  expect(mockGranaryPlacement(s, target, target, Date.now()).rule.type).toBe("footprint_occupied");
  s.groundItems.push({ id, itemKey: "barley", quantity: 1, expiresAt: null, ...target });
  expect(mockGranaryPlacement(s, target, farmer, Date.now()).rule.type).toBe("footprint_occupied");
});

it("retains building footprints and reserved loading tiles while bypassing the owned-granary limit", () => {
  const s = snapshot();
  s.buildings = FarmSnapshotSchema.parse({ ...s, buildings: [{ id, type: "granary", column: 6, row: 3,
    storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0,
    loadingTile: { column: 6, row: 5 }, startedAt: new Date(0).toISOString(), completesAt: new Date(0).toISOString() }] }).buildings;
  expect(mockGranaryPlacement(s, target, farmer, Date.now()).rule.type).toBe("valid");
  expect(mockGranaryPlacement(s, { column: 6, row: 3 }, farmer, Date.now()).rule.type).toBe("footprint_occupied");
  // A legacy building can have a separately reserved loading tile.
  s.buildings[0]!.loadingTile = { column: 5, row: 5 };
  // Block the only other loading point; the reserved tile must not be reused.
  s.groundItems.push({ id, itemKey: "barley", quantity: 1, expiresAt: null, column: 4, row: 5 });
  expect(mockGranaryPlacement(s, target, farmer, Date.now()).rule.type).toBe("road_access_required");
});

it("rejects disconnected or unfinished roads", () => {
  const s = snapshot(), cell = { column: 4, row: 0 };
  s.farm.roads = [{ column: 4, row: 2 }];
  expect(mockGranaryPlacement(s, cell, farmer, Date.now()).rule.type).toBe("road_access_required");
  s.farm.roads = [2, 3, 4].map(row => ({ column: 4, row, completesAt: Date.now() + 60000 }));
  expect(mockGranaryPlacement(s, cell, farmer, Date.now()).rule.type).toBe("road_access_required");
  s.farm.roads = [2, 3, 4].map(row => ({ column: 4, row }));
  expect(mockGranaryPlacement(s, cell, farmer, Date.now()).rule.type).toBe("valid");
});
