import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { mockGranaryPlacement, granaryBuildBlocker, granaryPlacement, buildingBuildBlocker, buildingPlacement, constructionCommands, constructionSummary } from "../../src/client/game/phaser/isometricBuildingPlacement";

const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null },
    carriedItem: { itemKey: "barley", quantity: 2, expiresAt: null }, gathering: null },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
const farmer = { column: 1, row: 5 };
const target = { column: 4, row: 3 };

it("connects level-8 warehouse placement to the existing cost, footprint and command", () => {
  const s = snapshot();
  expect(buildingBuildBlocker(s, 1000, "warehouse")).toBe("Unlock at level 8");
  s.farm.progression = { level: 8, breadSold: 0, barleySold: 0, beerSold: 0, requestsDelivered: 0,
    stats: { breadProduced: 0, processedBarley: 0, harvestedBarley: 0, harvests: 0, beerProduced: 0, fishFed: 0 } };
  expect(buildingBuildBlocker(s, 1000, "warehouse")).toContain("hands");
  s.farm.carriedItem = null;
  expect(buildingBuildBlocker(s, 1000, "warehouse")).toContain("Gather 4 reed and 6 clay");
  s.inventory = [{ itemKey: "reed", quantity: 4 }, { itemKey: "clay", quantity: 6 }];
  expect(buildingBuildBlocker(s, 1000, "warehouse")).toBeNull();
  expect(buildingPlacement(s, target, farmer, 1000, "warehouse")).toMatchObject({
    rule: { type: "valid" }, loading: { column: 4, row: 5 },
  });
  expect(buildingPlacement(s, target, farmer, 1000, "warehouse").footprint).toHaveLength(4);
  expect(buildingPlacement(s, target, target, 1000, "warehouse").rule.type).toBe("footprint_occupied");
  expect(buildingPlacement(s, { column: 4, row: 0 }, farmer, 1000, "warehouse").rule.type).toBe("road_access_required");
  expect(constructionCommands.warehouse).toBe("build_warehouse");
  expect(constructionSummary("warehouse")).toBe("Build warehouse · 4 reed · 6 clay · 3 minutes");
});

it("places one level-8 shrine with a one-tile footprint and its existing construction cost", () => {
  const s = snapshot();
  expect(buildingBuildBlocker(s, 1000, "smallShrine")).toBe("Unlock at level 8");
  s.farm.progression = { level: 8, breadSold: 0, barleySold: 0, beerSold: 0, requestsDelivered: 0,
    stats: { breadProduced: 0, processedBarley: 0, harvestedBarley: 0, harvests: 0, beerProduced: 0, fishFed: 0 } };
  expect(buildingBuildBlocker(s, 1000, "smallShrine")).toContain("hands");
  s.farm.carriedItem = null;
  expect(buildingBuildBlocker(s, 1000, "smallShrine")).toContain("Gather");
  s.inventory = [{ itemKey: "reed", quantity: 2 }, { itemKey: "clay", quantity: 4 }];
  expect(buildingBuildBlocker(s, 1000, "smallShrine")).toBeNull();
  const cell = { column: 7, row: 4 };
  const placement = buildingPlacement(s, cell, farmer, 1000, "smallShrine");
  expect(placement).toMatchObject({ rule: { type: "valid" }, loading: { column: 7, row: 5 } });
  expect(placement.footprint).toEqual([cell]);
  expect(buildingPlacement(s, cell, cell, 1000, "smallShrine").rule.type).toBe("footprint_occupied");
  expect(buildingPlacement(s, { column: 7, row: 2 }, farmer, 1000, "smallShrine").rule.type).toBe("road_access_required");
  expect(constructionCommands.smallShrine).toBe("build_small_shrine");
  expect(constructionSummary("smallShrine")).toBe("Build small shrine · 2 reed · 4 clay · 2 minutes");
  s.buildings = FarmSnapshotSchema.parse({ ...s, buildings: [{ id, type: "smallShrine", ...cell,
    storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0,
    startedAt: new Date(0).toISOString(), completesAt: new Date(120000).toISOString() }] }).buildings;
  expect(buildingBuildBlocker(s, 1000, "smallShrine")).toBe("Already built");
});

it.each(["granary", "mill", "breadOven", "brewery", "warehouse"] as const)("allows southern non-arable %s placement but rejects any farmland overlap", type => {
  const s = snapshot();
  for (const column of [-4, -2, 8, 10]) {
    expect(mockGranaryPlacement(s, { column, row: 6 }, farmer, 1000, false, type).rule.type).toBe("valid");
  }
  for (const column of [-1, 0, 6, 7]) {
    expect(mockGranaryPlacement(s, { column, row: 6 }, farmer, 1000, false, type).rule.type).toBe("outside_building_ground");
  }
  expect(mockGranaryPlacement(s, { column: 8, row: 8 }, farmer, 1000, false, type).rule.type).toBe("road_access_required");
  s.farm.roads = [{ column: 9, row: 6 }, { column: 9, row: 7 }];
  expect(mockGranaryPlacement(s, { column: 8, row: 8 }, farmer, 1000, false, type).rule.type).toBe("valid");
  s.farm.roads = [{ column: -3, row: 6 }, { column: -3, row: 7 }];
  expect(mockGranaryPlacement(s, { column: -4, row: 8 }, farmer, 1000, false, type).rule.type).toBe("valid");
});

it("checks brewery unlock, availability, materials and stored brewing jars", () => {
  const s = snapshot();
  expect(buildingBuildBlocker(s, 1000, "brewery")).toBe("Unlock at level 6");
  s.farm.progression = { level: 6, breadSold: 0, barleySold: 0, beerSold: 0, requestsDelivered: 0,
    stats: { breadProduced: 0, processedBarley: 0, harvestedBarley: 0, harvests: 0, beerProduced: 0, fishFed: 0 } };
  expect(buildingBuildBlocker(s, 1000, "brewery")).toContain("hands");
  s.farm.carriedItem = null;
  expect(buildingBuildBlocker(s, 1000, "brewery")).toContain("Gather");
  s.inventory = [{ itemKey: "reed", quantity: 4 }, { itemKey: "clay", quantity: 6 }, { itemKey: "emptyBeerJar", quantity: 2 }];
  expect(buildingBuildBlocker(s, 1000, "brewery")).toBe("Buy 2 brewing jars at the beer market.");
  expect(buildingPlacement(s, target, farmer, 1000, "brewery").rule.type).toBe("missing_material");
  s.inventory.push({ itemKey: "brewingVessels", quantity: 2 });
  expect(buildingBuildBlocker(s, 1000, "brewery")).toBeNull();
  expect(buildingPlacement(s, { column: 8, row: 6 }, farmer, 1000, "brewery")).toMatchObject({ rule: { type: "valid" }, loading: { column: 8, row: 5 } });
  expect(constructionCommands.brewery).toBe("build_brewery");
  expect(constructionSummary("brewery")).toBe("Build brewery · 4 reed · 6 clay · 2 brewing jars · 3 minutes");
  s.farm.roads = [{ column: 5, row: 4, completesAt: 6000 }];
  expect(buildingBuildBlocker(s, 1000, "brewery")).not.toBeNull();
});

it("builds the level-6 bread oven with its exact materials, tools and road access", () => {
  const s = snapshot();
  expect(buildingBuildBlocker(s, 1000, "breadOven")).toBe("Unlock at level 6");
  s.farm.progression = { level: 6, breadSold: 0, barleySold: 0, beerSold: 0, requestsDelivered: 0,
    stats: { breadProduced: 0, processedBarley: 0, harvestedBarley: 0, harvests: 0, beerProduced: 0, fishFed: 0 } };
  expect(buildingBuildBlocker(s, 1000, "breadOven")).toContain("hands");
  s.farm.carriedItem = null;
  s.inventory = [{ itemKey: "reed", quantity: 4 }, { itemKey: "clay", quantity: 5 }];
  expect(buildingBuildBlocker(s, 1000, "breadOven")).toContain("6 clay");
  s.groundItems = [{ id, itemKey: "clay", quantity: 1, expiresAt: null, column: 8, row: 2 }];
  expect(buildingBuildBlocker(s, 1000, "breadOven")).toContain("baking tools");
  expect(buildingPlacement(s, target, farmer, 1000, "breadOven").rule.type).toBe("missing_material");
  s.inventory.push({ itemKey: "bakingTools", quantity: 2 });
  expect(buildingBuildBlocker(s, 1000, "breadOven")).toBeNull();
  expect(buildingPlacement(s, target, farmer, 1000, "breadOven")).toMatchObject({ rule: { type: "valid" }, loading: { column: 4, row: 5 } });
  expect(buildingPlacement(s, target, target, 1000, "breadOven").rule.type).toBe("footprint_occupied");
  expect(buildingPlacement(s, { column: 4, row: 0 }, farmer, 1000, "breadOven").rule.type).toBe("road_access_required");
  expect(constructionCommands.breadOven).toBe("build_bread_oven");
  expect(constructionSummary("breadOven")).toBe("Build bread oven · 4 reed · 6 clay · 2 baking tools · 3 minutes");
});

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

it("protects building footprints but allows shared road access", () => {
  const s = snapshot();
  s.buildings = FarmSnapshotSchema.parse({ ...s, buildings: [{ id, type: "granary", column: 6, row: 3,
    storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0,
    loadingTile: { column: 6, row: 5 }, startedAt: new Date(0).toISOString(), completesAt: new Date(0).toISOString() }] }).buildings;
  expect(mockGranaryPlacement(s, target, farmer, Date.now()).rule.type).toBe("valid");
  expect(mockGranaryPlacement(s, { column: 6, row: 3 }, farmer, Date.now()).rule.type).toBe("footprint_occupied");
  // A legacy building can have a separately reserved loading tile.
  s.buildings[0]!.loadingTile = { column: 5, row: 5 };
  // Block the other loading point; the saved access tile can be shared.
  s.groundItems.push({ id, itemKey: "barley", quantity: 1, expiresAt: null, column: 4, row: 5 });
  expect(mockGranaryPlacement(s, target, farmer, Date.now())).toMatchObject({ rule: { type: "valid" }, loading: { column: 5, row: 5 } });
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
