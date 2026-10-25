import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { buildingDemolitionReason, withoutBuildingState } from "../../src/game-core/farm/buildingDemolition";

const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [],
  buildings: [{ id, type: "granary", column: 5, row: 3, storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0,
    startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString() }] });

it("protects the blessed shrine until the exact expiry, without blocking other buildings", () => {
  const s = snapshot();
  s.buildings[0]!.type = "smallShrine";
  s.farm.production.shrineBlessing = { buildingId: id, startedAt: new Date(10).toISOString(), expiresAt: new Date(200).toISOString() };
  expect(buildingDemolitionReason(s, id, 100)).toContain("blessing expires");
  expect(buildingDemolitionReason(s, id, 199)).toContain("blessing expires");
  expect(buildingDemolitionReason(s, id, 200)).toBeNull();
  s.buildings[0]!.type = "granary";
  expect(buildingDemolitionReason(s, id, 100)).toBeNull();
});

it("requires empty barley storage and a finished building", () => {
  const s = snapshot();
  expect(buildingDemolitionReason(s, id, 100)).toBeNull();
  s.buildings[0]!.storedBarley = 1;
  expect(buildingDemolitionReason(s, id, 100)).toContain("Empty");
  s.buildings[0]!.storedBarley = 0;
  s.buildings[0]!.completesAt = new Date(200).toISOString();
  expect(buildingDemolitionReason(s, id, 100)).toContain("construction");
  expect(buildingDemolitionReason(s, "farm", 100)).toContain("cannot");
});

it("protects active upgrades, milling and pending outputs", () => {
  const s = snapshot();
  s.farm.production.buildingUpgrades = { [id]: [{ level: 2, startedAt: new Date(0).toISOString(), completesAt: new Date(200).toISOString(), idempotencyKey: id }] };
  expect(buildingDemolitionReason(s, id, 100)).toContain("upgrading");
  s.farm.production.buildingUpgrades = {};
  s.farm.milling = { buildingId: id, recipe: "flour", startedAt: new Date(0).toISOString(), completesAt: new Date(200).toISOString(), barley: 2, output: 1 };
  expect(buildingDemolitionReason(s, id, 100)).toContain("active work");
  s.farm.milling = null;
  s.farm.millGoods.pending[id] = { flour: 1, brewersGroats: 0 };
  expect(buildingDemolitionReason(s, id, 100)).toContain("collect the goods");
});

it("protects deliveries even when the building has already been emptied", () => {
  const s = snapshot();
  s.farm.production.delivery = { buildingId: id, itemKey: "bread", quantity: 2 };
  expect(buildingDemolitionReason(s, id, 100)).toContain("deliveries");
  s.farm.production.delivery = null;
  s.farm.production.porter = { hiredAt: 0, expiresAt: 10000, checkedAt: 0, position: { column: 1, row: 5 },
    job: { buildingId: id, itemKey: "flour", quantity: 1, startedAt: 0, pickupAt: 50, completesAt: 200, path: [], pickupIndex: 0 } };
  expect(buildingDemolitionReason(s, id, 100)).toContain("deliveries");
});

it("cleans only target-owned state without modifying the input", () => {
  const s = snapshot();
  s.farm.production.pending.other = { itemKey: "bread", quantity: 2 };
  s.farm.production.buildingUpgrades = { [id]: [{ level: 2, startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString(), idempotencyKey: id }] };
  s.farm.production.shrineBlessing = { buildingId: id, startedAt: new Date(0).toISOString(), expiresAt: new Date(200).toISOString() };
  const before = JSON.stringify(s), next = withoutBuildingState(s, id);
  expect(next.production.shrineBlessing).toBeNull();
  expect(next.production.buildingUpgrades).toEqual({});
  expect(next.production.pending.other).toEqual({ itemKey: "bread", quantity: 2 });
  expect(JSON.stringify(s)).toBe(before);
});


it("allows an idle brewery to be demolished while a donkey mills elsewhere, but protects preparation and the mill", () => {
  const s = snapshot();
  s.buildings[0]!.type = "brewery";
  const millId = "00000000-0000-4000-8000-000000000002";
  s.buildings.push({ ...s.buildings[0]!, id: millId, type: "mill", column: 8 });
  s.farm.milling = { buildingId: millId, worker: "donkey", recipe: "brewersGroats",
    startedAt: new Date(50).toISOString(), completesAt: new Date(200).toISOString(), barley: 2, output: 1 };
  expect(buildingDemolitionReason(s, id, 40)).toContain("active work");
  expect(buildingDemolitionReason(s, id, 100)).toBeNull();
  expect(buildingDemolitionReason(s, millId, 100)).toContain("active work");
  s.farm.milling.worker = "farmer";
  expect(buildingDemolitionReason(s, id, 100)).toContain("active work");
});
