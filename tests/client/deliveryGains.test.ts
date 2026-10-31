import { expect, it } from "vitest";
import { FarmSnapshotSchema, type FarmSnapshot } from "../../src/schemas/farm";
import { deliveryGains } from "../../src/client/game/phaser/deliveryGains";
import { INITIAL_FARM_CONFIG } from "../../src/game-data/initialFarm";
const id = "00000000-0000-4000-8000-000000000001";
const iso = (n: number) => new Date(n).toISOString();
const loading = { column: 5, row: 5 };
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [{ id, type: "warehouse", column: 5, row: 3,
    storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0, loadingTile: loading, startedAt: iso(0), completesAt: iso(0) }] });
const next = (before: FarmSnapshot) => { const after = structuredClone(before); after.farm.version++; return after; };
it("shows +5 for a confirmed kept fish at visual arrival, not its resource quantity", () => {
  const before = snapshot(); before.player.points = 30;
  before.farm.carriedItem = { itemKey: "fish", quantity: 1, expiresAt: null };
  const after = next(before); after.farm.carriedItem = null; after.player.points = 35;
  after.inventory = [{ itemKey: "fish", quantity: 1, locations: { farm: 1 } }];
  expect(deliveryGains(before, after, 10000, 14000)).toEqual([{ cell: INITIAL_FARM_CONFIG.farmerSpawn, quantity: 5, at: 14000 }]);
  expect(deliveryGains(after, after, 14000)).toEqual([]);
  after.player.points = 30;
  expect(deliveryGains(before, after, 10000)).toEqual([]);
});
it("does not show points for releasing a fish, a purchase, or a failed deposit", () => {
  const before = snapshot(); before.farm.carriedItem = { itemKey: "fish", quantity: 1, expiresAt: null };
  const after = next(before); after.farm.carriedItem = null; after.player.points = 5;
  expect(deliveryGains(before, after, 10000)).toEqual([]);
  after.inventory = [{ itemKey: "fish", quantity: 1, locations: { farm: 1 } }];
  before.farm.carriedItem = null;
  expect(deliveryGains(before, after, 10000)).toEqual([]);
});
it.each(["barley", "sesame", "dates", "flour", "brewersGroats", "bread", "beer", "reed", "clay"] as const)("shows no points for %s storage even when another job earns points", itemKey => {
  const before = snapshot(); before.farm.carriedItem = { itemKey, quantity: 2, expiresAt: null };
  const after = next(before); after.farm.carriedItem = null; after.player.points = 40;
  after.inventory = [{ itemKey, quantity: 2, locations: { [id]: 2 } }];
  expect(deliveryGains(before, after, 10000)).toEqual([]);
});
it("shows no points for split flour deliveries or completed porter deliveries", () => {
  const before = snapshot(); before.farm.millGoods.delivery = { millId: id, bags: { flour: 2, brewersGroats: 0 } };
  const first = next(before); first.farm.millGoods.delivery!.bags.flour = 1;
  first.inventory = [{ itemKey: "flour", quantity: 1, locations: { [id]: 1 } }];
  expect(deliveryGains(before, first, 10000)).toEqual([]);
  const second = next(first); second.farm.millGoods.delivery = null;
  second.inventory = [{ itemKey: "flour", quantity: 2, locations: { [id]: 1, farm: 1 } }];
  expect(deliveryGains(first, second, 11000)).toEqual([]);
  before.farm.production.porter = { hiredAt: 0, expiresAt: 999999, checkedAt: 0, position: loading,
    job: { buildingId: id, itemKey: "bread", quantity: 2, startedAt: 0, pickupAt: 5000, completesAt: 10000, path: [loading], pickupIndex: 0, storageId: id } };
  const after = next(before); after.farm.production.porter!.job = null;
  after.inventory = [{ itemKey: "bread", quantity: 2, locations: { [id]: 2 } }];
  expect(deliveryGains(before, after, 10000)).toEqual([]);
});
