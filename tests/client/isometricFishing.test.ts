import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { canStartIsometricFishing, fishingApproach } from "../../src/client/game/phaser/isometricFishing";
import { pickupPose } from "../../src/client/game/phaser/isometricPickup";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import { FISH_CAPACITY } from "../../src/game-data/fishing";
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => {
  const s = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
    farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
      household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
    inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
  s.farm.progression = { level: 4, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, breadSold: 0, beerSold: 0, requestsDelivered: 0 };
  return s;
};
it("offers fishing on both water rows only when unlocked with empty hands and storage", () => {
  const s = snapshot();
  expect(canStartIsometricFishing(s, { column: 2, row: 10 }, 1000)).toBe(true);
  expect(canStartIsometricFishing(s, { column: 2, row: 11 }, 1000)).toBe(true);
  expect(canStartIsometricFishing(s, { column: 2, row: 9 }, 1000)).toBe(false);
  s.farm.progression!.level = 3;
  expect(canStartIsometricFishing(s, { column: 2, row: 10 }, 1000)).toBe(false);
  s.farm.progression!.level = 4;
  s.farm.carriedItem = { itemKey: "barley", quantity: 1, expiresAt: null };
  expect(canStartIsometricFishing(s, { column: 2, row: 10 }, 1000)).toBe(false);
  s.farm.carriedItem = null;
  s.inventory = [{ itemKey: "fish", quantity: FISH_CAPACITY }];
  expect(canStartIsometricFishing(s, { column: 2, row: 10 }, 1000)).toBe(false);
});
it("routes to the nearest reachable bank and normalizes either water row for the server", () => {
  const s = snapshot();
  s.objects = [{ id, type: "reeds", column: 2, row: 9 }];
  const plan = fishingApproach(s, { column: 1, row: 8 }, { column: 2, row: 11 }, 1000)!;
  expect(plan.bank).toEqual({ column: 1, row: 9 });
  expect(plan.target).toEqual({ column: 1, row: 10 });
  expect(pickupPose(plan.path, 1000, 1000).walking).toBe(true);
  expect(pickupPose(plan.path, 1000, 5000).position).toEqual(plan.bank);
});
it("does not invent a route through blocked riverbanks", () => {
  const s = snapshot();
  s.objects = Array.from({ length: 16 }, (_, n) => ({ id, type: "reeds", column: n - 4, row: 9 }));
  expect(fishingApproach(s, { column: 1, row: 8 }, { column: 2, row: 10 }, 1000)).toBeNull();
});
