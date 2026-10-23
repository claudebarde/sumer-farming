import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { farmRenderKey } from "../../src/client/game/phaser/farmRenderState";
const id = "00000000-0000-4000-8000-000000000001";
const fixture = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });

it("keeps idle scenery across polling versions and elapsed time", () => {
  const s = fixture(), key = farmRenderKey(s, 1000);
  s.farm.version++;
  s.player.shekelBalance = 100;
  expect(farmRenderKey(s, 60000)).toBe(key);
});
it("detects visible inventory, scenery and finished output changes", () => {
  const s = fixture(), key = farmRenderKey(s, 1000);
  s.inventory = [{ itemKey: "brewingVessels", quantity: 2 }];
  expect(farmRenderKey(s, 1000)).not.toBe(key);
  s.inventory = [];
  s.farm.production.pending[id] = { itemKey: "bread", quantity: 2 };
  expect(farmRenderKey(s, 1000)).not.toBe(key);
});
it("reconciles shrine expiry on return without a server response", () => {
  const s = fixture();
  s.farm.production.shrineBlessing = { buildingId: id, item: "bread", startedAt: new Date(0).toISOString(), expiresAt: new Date(5000).toISOString() };
  expect(farmRenderKey(s, 1000)).toBe(farmRenderKey(s, 4999));
  expect(farmRenderKey(s, 5000)).not.toBe(farmRenderKey(s, 4999));
  expect(farmRenderKey(s, 5000)).toBe(farmRenderKey(s, 60000));
});
it("retains construction progress and completion refreshes without idle rebuilds", () => {
  const s = fixture();
  s.farm.roads = [{ column: 7, row: 4, completesAt: 12000 }];
  expect(farmRenderKey(s, 1000)).toBe(farmRenderKey(s, 4000));
  expect(farmRenderKey(s, 6000)).not.toBe(farmRenderKey(s, 4000));
  expect(farmRenderKey(s, 12000)).not.toBe(farmRenderKey(s, 11999));
  expect(farmRenderKey(s, 12000)).toBe(farmRenderKey(s, 60000));
});
it("updates carried goods through the actor renderer without rebuilding scenery", () => {
  const s = fixture(), key = farmRenderKey(s, 1000);
  s.farm.carriedItem = { itemKey: "water", quantity: 1, expiresAt: null };
  expect(farmRenderKey(s, 1000)).toBe(key);
});
