import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import { canBakeBread, canStoreBread } from "../../src/client/game/phaser/isometricBaking";
import { buildingDemolitionReason } from "../../src/game-core/farm/buildingDemolition";
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, progression: { level: 6, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, breadSold: 0, requestsDelivered: 0 }, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [{ itemKey: "flour", quantity: 2 }], objects: [], groundItems: [], crops: [], improvements: [],
  buildings: [{ id, type: "breadOven", column: 4, row: 3, storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0,
    startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString(), loadingTile: { column: 4, row: 5 } }] });

it("offers baking only with flour, an available farmer and a completed unlocked oven", () => {
  const s = snapshot();
  expect(canBakeBread(s, id, 1000)).toBe(true);
  s.inventory[0]!.quantity = 1;
  expect(canBakeBread(s, id, 1000)).toBe(false);
  s.inventory[0]!.quantity = 2;
  s.farm.carriedItem = { itemKey: "barley", quantity: 1, expiresAt: null };
  expect(canBakeBread(s, id, 1000)).toBe(false);
  s.farm.carriedItem = null;
  s.farm.progression!.level = 5;
  expect(canBakeBread(s, id, 1000)).toBe(false);
  s.farm.progression!.level = 6;
  s.buildings[0]!.completesAt = new Date(2000).toISOString();
  expect(canBakeBread(s, id, 1000)).toBe(false);
  s.buildings[0]!.completesAt = new Date(1).toISOString();
  s.farm.production.baking[id] = { startedAt: new Date(500).toISOString(), completesAt: new Date(300500).toISOString(), output: 2 };
  expect(canBakeBread(s, id, 1000)).toBe(false);
});

it("offers collection only with storage room and protects pending bread from demolition", () => {
  const s = snapshot();
  expect(canStoreBread(s, id, 1000)).toBe(false);
  s.farm.production.pending[id] = { itemKey: "bread", quantity: 2 };
  expect(canStoreBread(s, id, 1000)).toBe(true);
  expect(buildingDemolitionReason(s, id, 1000)).not.toBeNull();
  s.inventory.push({ itemKey: "bread", quantity: 10 });
  expect(canStoreBread(s, id, 1000)).toBe(false);
  s.inventory.pop();
  s.farm.production.delivery = { itemKey: "bread", quantity: 2, buildingId: id };
  expect(canStoreBread(s, id, 1000)).toBe(false);
});
