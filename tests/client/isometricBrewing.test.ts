import { expect, it, vi } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import { canSupplyBrewery, breweryOutputPlacement, activeBrewingPreparation } from "../../src/client/game/phaser/isometricBrewing";
import { canStoreBread } from "../../src/client/game/phaser/isometricBaking";
import { farmerProductionJob } from "../../src/game-core/farm/farmerProduction";
import { assertFarmerAvailable } from "../../src/server/services/farmerAvailability";
const id = "00000000-0000-4000-8000-000000000001";
const fixture = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, progression: { level: 6, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, breadSold: 0, requestsDelivered: 0 }, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [{ itemKey: "brewersGroats", quantity: 2 }, { itemKey: "emptyBeerJar", quantity: 2 }], objects: [], crops: [], groundItems: [], improvements: [],
  buildings: [{ id, type: "brewery", column: 4, row: 3, storedBarley: 0, brewingBarley: 0, brewingWater: 2, emptyBeerJars: 2, beerReadyAt: null, beerServed: 0,
    startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString(), loadingTile: { column: 4, row: 5 } }] });

it("offers brewing only with the recipe, unlocked completed brewery and empty-handed available farmer", () => {
  const s = fixture(), b = s.buildings[0]!;
  expect(canSupplyBrewery(s, b, "start_brewing", 1000)).toBe(true);
  b.brewingWater = 1;
  expect(canSupplyBrewery(s, b, "start_brewing", 1000)).toBe(false);
  b.brewingWater = 2;
  s.farm.carriedItem = { itemKey: "water", quantity: 1, expiresAt: null };
  expect(canSupplyBrewery(s, b, "start_brewing", 1000)).toBe(false);
  b.brewingWater = 1;
  expect(canSupplyBrewery(s, b, "deliver", 1000)).toBe(true);
  s.farm.carriedItem = null;
  expect(canSupplyBrewery(s, { column: 0, row: 10 }, "collect_water", 1000)).toBe(true);
  expect(canSupplyBrewery(s, b, "stock_jars", 1000)).toBe(true);
  s.farm.production.pending[id] = { itemKey: "beer", quantity: 2 };
  expect(canSupplyBrewery(s, b, "start_brewing", 1000)).toBe(false);
  expect(canStoreBread(s, id, 1000)).toBe(true);
  s.inventory.push({ itemKey: "beer", quantity: 10 });
  expect(canStoreBread(s, id, 1000)).toBe(false);
});

it("uses the saved connection for beer output without changing B/C when other roads appear", () => {
  expect(breweryOutputPlacement(fixture().buildings[0]!).tile).toEqual({ column: 4, row: 4 });
  expect(breweryOutputPlacement({ column: 4, row: 6, loadingTile: { column: 4, row: 5 } }).tile).toEqual({ column: 5, row: 6 });
});

it("restores the farmer preparation lock and releases it exactly at fermentation start", () => {
  const s = fixture();
  s.farm.production.brewing = { [id]: { preparation: { departedAt: 1000, stepDurationMs: 500, path: [{ column: 1, row: 5 }, { column: 4, row: 5 }], supplyIndex: 0 },
    arrivedAt: new Date(1500).toISOString(), startedAt: new Date(9500).toISOString(), completesAt: new Date(909500).toISOString() } };
  const restored = FarmSnapshotSchema.parse(JSON.parse(JSON.stringify(s)));
  expect(activeBrewingPreparation(restored, 9499)).toBeDefined();
  expect(farmerProductionJob(restored.farm, 9499)?.type).toBe("brewing");
  expect(activeBrewingPreparation(restored, 9500)).toBeUndefined();
  expect(farmerProductionJob(restored.farm, 9500)).toBeNull();
  vi.useFakeTimers();
  try {
    vi.setSystemTime(9499);
    expect(() => assertFarmerAvailable({ production: restored.farm.production, fishing: null, carriedItemKey: null })).toThrow("preparing beer");
    vi.setSystemTime(9500);
    expect(() => assertFarmerAvailable({ production: restored.farm.production, fishing: null, carriedItemKey: null })).not.toThrow();
  } finally { vi.useRealTimers(); }
});
