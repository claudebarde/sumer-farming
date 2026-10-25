import { describe, expect, it } from "vitest";
import { advancePorter, PORTER_HOME, PORTER_MARKET, porterRoadPath, porterPath, porterRoadRemovalReason, type PorterBuilding, type PorterStack } from "../../src/game-core/farm/porter";
import { PORTER_HIRE_MS, type Porter } from "../../src/game-data/porter";
import { porterAwaitingPickup } from "../../src/client/game/phaser/isometricPorter";

const porter: Porter = { hiredAt: 0, expiresAt: PORTER_HIRE_MS, checkedAt: 0, position: PORTER_HOME, job: null };
const mill: PorterBuilding = { id: "mill", type: "mill", column: 3, row: 3, completesAt: 0, loadingTile: { column: 3, row: 5 } };
const warehouse: PorterBuilding = { id: "warehouse", type: "warehouse", column: 5, row: 3, completesAt: 0, loadingTile: { column: 5, row: 5 } };
const stack: PorterStack = { buildingId: "mill", itemKey: "flour", quantity: 3, readyAt: 0 };
const base = { porter, buildings: [mill, warehouse], roads: [], inventory: {}, reserved: {}, stacks: [stack], now: 0 };
describe("automatic porter", () => {
  it("chains split bread pickups directly from warehouse to oven to farm, then returns home", () => {
    const oven: PorterBuilding = { ...mill, id: "oven", type: "breadOven" };
    const input = { ...base, porter: { ...porter, home: PORTER_MARKET, position: PORTER_MARKET },
      buildings: [oven, warehouse], inventory: { bread: 9 }, locations: { bread: { farm: 0, warehouse: 9 } },
      stacks: [{ buildingId: oven.id, itemKey: "bread" as const, quantity: 2, readyAt: 0 }] };
    const first = advancePorter(input);
    expect(first.porter.job).toMatchObject({ quantity: 1, storageId: warehouse.id });
    const second = advancePorter({ ...input, ...first, now: first.porter.job!.completesAt });
    expect(second.locations.bread).toMatchObject({ warehouse: 10 });
    expect(second.porter.returnTrip ?? null).toBeNull();
    expect(second.porter.job).toMatchObject({ quantity: 1, storageId: "farm", startedAt: first.porter.job!.completesAt });
    const job = second.porter.job!;
    expect(job.path[0]).toEqual(warehouse.loadingTile);
    expect(job.path[job.pickupIndex]).toEqual(first.porter.job!.path[first.porter.job!.pickupIndex]);
    expect(job.path.at(-1)).toEqual({ column: 1, row: 5 });
    expect(job.path).not.toContainEqual(PORTER_MARKET);
    const finished = advancePorter({ ...input, ...JSON.parse(JSON.stringify(second)), now: job.completesAt });
    expect(finished.inventory.bread).toBe(11);
    expect(finished.locations.bread).toEqual({ warehouse: 10, farm: 1 });
    expect(finished.porter.job).toBeNull();
    expect(finished.porter.returnTrip?.path.at(-1)).toEqual(PORTER_MARKET);
    const offline = advancePorter({ ...input, ...first, now: 100000 });
    expect(offline.inventory.bread).toBe(11);
    expect(offline.locations.bread).toEqual(finished.locations.bread);
    expect(offline.porter.position).toEqual(PORTER_MARKET);
    expect(advancePorter({ ...input, ...offline, now: 200000 }).inventory.bread).toBe(11);
  });
  it.each(["flour", "brewersGroats", "bread", "beer"] as const)("takes one of two %s when only one space remains", itemKey => {
    const input = { ...base, porter: { ...porter, position: PORTER_MARKET }, buildings: [mill], inventory: { [itemKey]: 9 }, stacks: [{ ...stack, itemKey, quantity: 2 }] };
    const started = advancePorter(input);
    const job = started.porter.job!;
    expect(job.quantity).toBe(1);
    expect(started.stacks[0]!.quantity).toBe(1);
    expect(started.stacks[0]!.quantity + porterAwaitingPickup(started.porter, mill.id, job.pickupAt - 1)).toBe(2);
    expect(started.stacks[0]!.quantity + porterAwaitingPickup(started.porter, mill.id, job.pickupAt)).toBe(1);
    const stored = advancePorter({ ...input, ...started, now: 50000 });
    expect(stored.inventory[itemKey]).toBe(10);
    expect(stored.stacks[0]!.quantity).toBe(1);
    expect(stored.porter.job).toBeNull();
  });
  it("reserves goods immediately but only credits inventory on arrival", () => {
    const started = advancePorter(base);
    expect(started.stacks[0]?.quantity).toBe(0);
    expect(started.inventory.flour).toBeUndefined();
    expect(started.porter.job?.path.at(-1)).toEqual(warehouse.loadingTile);
    const finished = advancePorter({ ...base, ...started, now: 10000 });
    expect(finished.inventory.flour).toBe(3);
    expect(finished.porter.job).toBeNull();
    expect(advancePorter({ ...base, ...finished, now: 20000 }).inventory.flour).toBe(3);
  });
  it("splits warehouse overflow to farm during offline catch-up", () => {
    const first = advancePorter({ ...base, inventory: { flour: 9 }, locations: { flour: { farm: 0, warehouse: 9 } } });
    expect(first.porter.job?.quantity).toBe(1);
    const done = advancePorter({ ...base, ...first, now: 20000 });
    expect(done.inventory.flour).toBe(12);
    expect(done.porter.position).toEqual(PORTER_MARKET);
  });
  it("waits for free storage and respects farmer cargo reservations", () => {
    const waiting = advancePorter({ ...base, inventory: { flour: 18 }, reserved: { flour: 2 }, now: 5000 });
    expect(waiting.porter.job).toBeNull();
    expect(waiting.stacks[0]?.quantity).toBe(3);
    const resumed = advancePorter({ ...base, ...waiting, inventory: { flour: 17 }, locations: { flour: { farm: 9, warehouse: 8 } }, reserved: { flour: 2 }, now: 6000 });
    expect(resumed.porter.job?.quantity).toBe(1);
    expect(resumed.porter.job?.startedAt).toBe(5000);
  });
  it("finishes a booked trip after expiry but never starts another", () => {
    const first = advancePorter({ ...base, porter: { ...porter, expiresAt: 100 }, inventory: { flour: 9 }, locations: { flour: { farm: 0, warehouse: 9 } } });
    const done = advancePorter({ ...base, ...first, now: 50000 });
    expect(done.inventory.flour).toBe(10);
    expect(done.stacks[0]?.quantity).toBe(2);
    expect(done.porter.job).toBeNull();
  });
  it("does not collect products that become ready after hire expiry", () => {
    const done = advancePorter({ ...base, stacks: [{ ...stack, readyAt: PORTER_HIRE_MS + 1 }], now: PORTER_HIRE_MS + 10000 });
    expect(done.inventory.flour).toBeUndefined();
    expect(done.stacks[0]?.quantity).toBe(3);
  });
  it("uses a completed farm when warehouse construction is unfinished", () => {
    const first = advancePorter({ ...base, buildings: [mill, { ...warehouse, completesAt: 5000 }] });
    expect(first.porter.job?.path.at(-1)).toEqual({ column: 1, row: 5 });
  });
  it("routes around footprints rather than through buildings", () => {
    const roads = [{ column: 5, row: 2 }, { column: 6, row: 2 }, { column: 7, row: 2 }, { column: 7, row: 3 }, { column: 7, row: 4 }];
    const result = advancePorter({ ...base, roads, porter: { ...porter, position: { column: 5, row: 2 } } });
    expect(result.porter.job).not.toBeNull();
    expect(result.porter.job!.path.some(p => p.column >= 5 && p.column <= 6 && p.row >= 3 && p.row <= 4)).toBe(false);
  });
  it("cannot cross ground or an unfinished or removed road, while farmer routes remain unchanged", () => {
    const from = { column: 0, row: 5 }, to = { column: 0, row: 3 };
    expect(porterPath([], [], from, to, 0)).not.toBeNull();
    expect(porterRoadPath([], [{ ...to }, { column: 0, row: 4, completesAt: 100 }], from, to, 0)).toBeNull();
    expect(porterRoadPath([], [{ ...to }, { column: 0, row: 4, removing: true }], from, to, 100)).toBeNull();
    expect(porterRoadPath([], [{ ...to }, { column: 0, row: 4 }], from, to, 100)).toHaveLength(3);
  });
  it("leaves goods untouched when a building has no road route", () => {
    const result = advancePorter({ ...base, buildings: [{ ...mill, row: 0, loadingTile: { column: 3, row: 2 } }] });
    expect(result.porter.job).toBeNull();
    expect(result.stacks).toEqual(base.stacks);
    expect(result.inventory).toEqual({});
  });
  it("stores exactly once then persists a road-only return to the hired market location", () => {
    const start = advancePorter({ ...base, porter: { ...porter, home: PORTER_MARKET, position: PORTER_MARKET } });
    const atStore = advancePorter({ ...base, ...start, now: start.porter.job!.completesAt });
    expect(atStore.inventory.flour).toBe(3);
    expect(atStore.porter.job).toBeNull();
    expect(atStore.porter.returnTrip?.path.at(-1)).toEqual(PORTER_MARKET);
    expect(atStore.porter.returnTrip?.path.every(p => p.row === 5)).toBe(true);
    const returned = advancePorter({ ...base, ...JSON.parse(JSON.stringify(atStore)), now: atStore.porter.returnTrip!.completesAt });
    expect(returned.porter.position).toEqual(PORTER_MARKET);
    expect(returned.porter.returnTrip).toBeNull();
    expect(returned.inventory.flour).toBe(3);
    expect(porterRoadRemovalReason(atStore.porter, atStore.porter.returnTrip!.path[0]!)).toContain("porter");
  });
});
