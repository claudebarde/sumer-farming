import { expect, it } from "vitest";
import { FarmSnapshotSchema, type FarmSnapshot } from "../../src/schemas/farm";
import { productionGains } from "../../src/client/game/phaser/productionGains";
const id = "00000000-0000-4000-8000-000000000001";
const iso = (n: number) => new Date(n).toISOString();
const loading = { column: 5, row: 5 };
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [{ id, type: "warehouse", column: 5, row: 3,
    storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0, loadingTile: loading, startedAt: iso(0), completesAt: iso(0) }] });
const next = (before: FarmSnapshot) => { const after = structuredClone(before); after.farm.version++; return after; };

it.each(["flour", "brewersGroats", "oil"] as const)("shows %s points for both workers only when a batch settles", recipe => {
 for (const worker of ["farmer", "donkey"] as const) {
  const before = snapshot(); before.buildings[0]!.type = recipe === "oil" ? "oilMill" : "mill";
  before.farm.milling = {buildingId: id, recipe, worker, barley: 2, output: 1, startedAt: iso(1000), completesAt: iso(10000)};
  const after = next(before); after.farm.milling = null;
  expect(productionGains(before, after, 10010)).toMatchObject([{quantity: worker === "donkey" ? 35 : 30, at: 10010}]);
  expect(productionGains(after, after, 10020)).toEqual([]);
  expect(productionGains(before, before, 10020)).toEqual([]);
  expect(productionGains(before, after, 9999)).toEqual([]);
  expect(productionGains(before, after, 25000)).toEqual([]);
 }
});
it("shows bread and beer completions together at their own output tiles", () => {
 const before = snapshot(); before.buildings[0]!.type = "breadOven";
 const breweryId = "00000000-0000-4000-8000-000000000002";
 before.buildings.push({...before.buildings[0]!, id: breweryId, type: "brewery", column: 9, beerReadyAt: iso(10000)});
 before.farm.production.baking = {[id]: {startedAt: iso(1000), completesAt: iso(10000), output: 2}};
 const after = next(before); after.farm.production.baking = {}; after.buildings[1]!.beerReadyAt = null;
 const gains = productionGains(before, after, 10020);
 expect(gains.map(g => g.quantity)).toEqual([40, 40]);
 expect(gains[0]!.cell).not.toEqual(gains[1]!.cell);
 expect(productionGains(after, after, 10030)).toEqual([]);
});
it("preserves parallel mill completions and ignores unrelated farm changes", () => {
 const before = snapshot(); before.buildings[0]!.type = "mill";
 const oilId = "00000000-0000-4000-8000-000000000002";
 before.buildings.push({...before.buildings[0]!, id: oilId, type: "oilMill", column: 9});
 before.farm.milling = {buildingId: id, recipe: "flour", worker: "farmer", barley: 2, output: 1, startedAt: iso(1000), completesAt: iso(10000)};
 before.farm.production.donkeyMilling = {...before.farm.milling, buildingId: oilId, recipe: "oil", worker: "donkey", output: 3};
 const after = next(before); after.farm.milling = null; after.farm.production.donkeyMilling = null;
 expect(productionGains(before, after, 10020).map(g => g.quantity)).toEqual([30, 35]);
 after.farm.id = oilId;
 expect(productionGains(before, after, 10020)).toEqual([]);
});
