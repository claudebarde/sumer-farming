import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { isometricIdleEligible, isometricIdleWorld } from "../../src/client/game/phaser/isometricIdle";
import { chooseIdleStep } from "../../src/client/game/phaser/farmerIdle";
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
it("wanders only while empty-handed and not doing saved work", () => {
  const s = snapshot();
  expect(isometricIdleEligible(s, 1000)).toBe(true);
  s.farm.carriedItem = { itemKey: "barley", quantity: 1, expiresAt: null };
  expect(isometricIdleEligible(s, 1000)).toBe(false);
  s.farm.carriedItem = null;
  s.farm.roads = [{ column: 4, row: 4, completesAt: 2000 }];
  expect(isometricIdleEligible(s, 1000)).toBe(false);
  expect(isometricIdleEligible(s, 2000)).toBe(true);
});
it("uses completed roads and avoids scenery, dropped goods, water and buildings", () => {
  const s = snapshot();
  s.objects = [{ id, type: "bush", column: 4, row: 4 }];
  s.groundItems = [{ id, itemKey: "clay", quantity: 1, expiresAt: null, column: 5, row: 4 }];
  s.farm.roads = [{ column: 6, row: 4, completesAt: 2000 }];
  const world = isometricIdleWorld(s, 1000);
  for (const cell of [{ column: 4, row: 4 }, { column: 5, row: 4 }, { column: 1, row: 3 }, { column: 4, row: 10 }]) expect(world.allowed(cell)).toBe(false);
  expect(world.roads.has("6:4")).toBe(false);
  const start = { column: 4, row: 5 };
  expect(chooseIdleStep(start, start, world, 0)?.row).toBe(5);
});
