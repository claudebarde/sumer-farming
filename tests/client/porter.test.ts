import { describe, expect, it } from "vitest";
import { advancePorter, PORTER_HOME, type PorterBuilding, type PorterStack } from "../../src/game-core/farm/porter";
import { PORTER_HIRE_MS, type Porter } from "../../src/game-data/porter";

const porter: Porter = { hiredAt: 0, expiresAt: PORTER_HIRE_MS, checkedAt: 0, position: PORTER_HOME, job: null };
const mill: PorterBuilding = { id: "mill", type: "mill", column: 3, row: 3, completesAt: 0, loadingTile: { column: 3, row: 5 } };
const warehouse: PorterBuilding = { id: "warehouse", type: "warehouse", column: 5, row: 3, completesAt: 0, loadingTile: { column: 5, row: 5 } };
const stack: PorterStack = { buildingId: "mill", itemKey: "flour", quantity: 3, readyAt: 0 };
const base = { porter, buildings: [mill, warehouse], roads: [], inventory: {}, reserved: {}, stacks: [stack], now: 0 };
describe("automatic porter", () => {
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
    const first = advancePorter({ ...base, inventory: { flour: 9 } });
    expect(first.porter.job?.quantity).toBe(1);
    const done = advancePorter({ ...base, ...first, now: 20000 });
    expect(done.inventory.flour).toBe(12);
    expect(done.porter.position).toEqual({ column: 1, row: 5 });
  });
  it("waits for free storage and respects farmer cargo reservations", () => {
    const waiting = advancePorter({ ...base, inventory: { flour: 18 }, reserved: { flour: 2 }, now: 5000 });
    expect(waiting.porter.job).toBeNull();
    expect(waiting.stacks[0]?.quantity).toBe(3);
    const resumed = advancePorter({ ...base, ...waiting, inventory: { flour: 17 }, reserved: { flour: 2 }, now: 6000 });
    expect(resumed.porter.job?.quantity).toBe(1);
    expect(resumed.porter.job?.startedAt).toBe(5000);
  });
  it("finishes a booked trip after expiry but never starts another", () => {
    const first = advancePorter({ ...base, porter: { ...porter, expiresAt: 100 }, inventory: { flour: 9 } });
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
    const result = advancePorter({ ...base, porter: { ...porter, position: { column: 5, row: 2 } } });
    expect(result.porter.job).not.toBeNull();
    expect(result.porter.job!.path.some(p => p.column >= 5 && p.column <= 6 && p.row >= 3 && p.row <= 4)).toBe(false);
  });
});
