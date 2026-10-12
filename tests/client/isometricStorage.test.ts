import { describe, expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { barleyStoragePlan } from "../../src/client/game/phaser/isometricStorage";
import { granaryCapacityForLevel } from "../../src/game-data/storage";
import { pickupPose, transferGroundItems } from "../../src/client/game/phaser/isometricPickup";

const id = "00000000-0000-4000-8000-000000000001";
const from = { column: 3, row: 5 };
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null },
    carriedItem: { itemKey: "barley", quantity: 2, expiresAt: null }, gathering: null },
  inventory: [{ itemKey: "barley", quantity: 0 }], objects: [], groundItems: [], crops: [], improvements: [],
  buildings: [{ id, type: "granary", column: 5, row: 3, loadingTile: { column: 5, row: 5 }, storedBarley: 0,
    brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0, startedAt: new Date(0).toISOString(), completesAt: new Date(0).toISOString() }] });

describe("manual isometric barley storage", () => {
  it("targets the selected granary even when only part of the load fits", () => {
    const s = snapshot(); s.buildings[0]!.storedBarley = granaryCapacityForLevel(1) - 1;
    expect(barleyStoragePlan(s, from, 1000, id).plan?.destination).toMatchObject({
      type: "granary", room: 1, target: { column: 5, row: 3 },
    });
  });
  it("never redirects a selected full, unfinished, missing or unreachable granary to the farm", () => {
    const s = snapshot();
    expect(barleyStoragePlan(s, from, 1000, "missing").plan).toBeNull();
    s.buildings[0]!.storedBarley = granaryCapacityForLevel(1);
    expect(barleyStoragePlan(s, from, 1000, id)).toEqual({ hasStorage: false, plan: null });
    s.buildings[0]!.storedBarley = 0;
    s.buildings[0]!.completesAt = new Date(2000).toISOString();
    expect(barleyStoragePlan(s, from, 1000, id).plan).toBeNull();
    s.buildings[0]!.completesAt = new Date(0).toISOString();
    s.objects = [{ id, type: "rock", column: 5, row: 5 }];
    expect(barleyStoragePlan(s, from, 1000, id).plan).toBeNull();
  });
  it("prefers a completed granary and routes to its loading tile", () => {
    const s = snapshot(), before = JSON.stringify(s);
    const plan = barleyStoragePlan(s, from, 1000).plan!;
    expect(plan.destination.type).toBe("granary");
    expect(plan.path.at(-1)).toEqual({ column: 5, row: 5 });
    expect(JSON.stringify(s)).toBe(before);
  });
  it("uses the farm if the granary cannot fit the full load", () => {
    const s = snapshot(); s.buildings[0]!.storedBarley = granaryCapacityForLevel(1) - 1;
    expect(barleyStoragePlan(s, from, 1000).plan?.destination.type).toBe("farm");
    expect(barleyStoragePlan(s, from, 1000).plan?.path.at(-1)).toEqual({ column: 1, row: 5 });
  });
  it("ignores unfinished granaries and warehouses", () => {
    const s = snapshot(); s.buildings[0]!.completesAt = new Date(2000).toISOString();
    expect(barleyStoragePlan(s, from, 1000).plan?.destination.type).toBe("farm");
    s.buildings[0]!.type = "warehouse"; s.buildings[0]!.completesAt = new Date(0).toISOString();
    s.inventory[0]!.quantity = 5;
    expect(barleyStoragePlan(s, from, 1000)).toEqual({ hasStorage: false, plan: null });
  });
  it("reports no space only when both stores are full, and allows partial deposits", () => {
    const s = snapshot(); s.inventory[0]!.quantity = 5; s.buildings[0]!.storedBarley = granaryCapacityForLevel(1);
    expect(barleyStoragePlan(s, from, 1000)).toEqual({ hasStorage: false, plan: null });
    s.buildings[0]!.storedBarley--;
    expect(barleyStoragePlan(s, from, 1000).plan?.destination).toMatchObject({ type: "granary", room: 1 });
    s.buildings[0]!.storedBarley++; s.inventory[0]!.quantity--;
    expect(barleyStoragePlan(s, from, 1000).plan?.destination).toMatchObject({ type: "farm", room: 1 });
  });
  it("falls back from a blocked granary loading tile", () => {
    const s = snapshot(); s.objects = [{ id, type: "rock", column: 5, row: 5 }];
    expect(barleyStoragePlan(s, from, 1000).plan?.destination.type).toBe("farm");
  });
  it("does not offer storage for empty hands or another good", () => {
    const s = snapshot(); s.farm.carriedItem = null;
    expect(barleyStoragePlan(s, from, 1000).plan).toBeNull();
    s.farm.carriedItem = { itemKey: "clay", quantity: 1, expiresAt: null };
    expect(barleyStoragePlan(s, from, 1000).plan).toBeNull();
  });
  it("reuses timestamp-based carried delivery without adding ground bundles", () => {
    const s = snapshot(), plan = barleyStoragePlan(s, from, 1000).plan!;
    const transfer = { type: "store" as const, before: s, path: plan.path, startedAt: 1000, carried: 2, building: { column: 5, row: 3 } };
    expect(transferGroundItems(s.groundItems, transfer)).toEqual([]);
    expect(pickupPose(plan.path, 1000, 1090).walking).toBe(true);
    expect(pickupPose(plan.path, 1000, 100000)).toMatchObject({ done: true, position: plan.path.at(-1) });
  });
});
