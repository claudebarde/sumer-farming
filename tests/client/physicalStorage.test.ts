import { describe, expect, it } from "vitest";
import { changeStorageLocations, initialStorageLocations, physicalDeliveryStop } from "../../src/game-core/farm/physicalStorage";
import { sharedStorageAllocation } from "../../src/game-core/farm/storageDisplay";

const buildings = [{ id: "warehouse", type: "warehouse", completesAt: 0 }];
describe("physical storage", () => {
  it("migrates existing stock once, farm first, without discarding overflow", () => {
    expect(initialStorageLocations("bread", 9, buildings, 100)).toEqual({ farm: 9, warehouse: 0 });
    expect(initialStorageLocations("bread", 24, buildings, 100)).toEqual({ farm: 10, warehouse: 14 });
    expect(initialStorageLocations("dates", 4, buildings, 100)).toEqual({ farm: 0, warehouse: 4 });
  });
  it("does not relocate existing farm goods when warehouse capacity becomes available", () => {
    const locations = { farm: 8 };
    expect(changeStorageLocations("bread", locations, 0, buildings, 100)).toEqual(locations);
    expect(changeStorageLocations("bread", locations, 3, buildings, 100)).toEqual({ farm: 8, warehouse: 3 });
  });
  it("spends farm stock first without shuffling remaining warehouse stock", () => {
    expect(changeStorageLocations("beer", { farm: 4, warehouse: 7 }, -3, buildings, 100)).toEqual({ farm: 1, warehouse: 7 });
    expect(changeStorageLocations("beer", { farm: 1, warehouse: 7 }, -3, buildings, 100)).toEqual({ farm: 0, warehouse: 5 });
  });
  it("uses actual free space and honours reservations and separate capacities", () => {
    const entry = { itemKey: "clay", quantity: 10, locations: { farm: 3, warehouse: 7 } };
    expect(physicalDeliveryStop("clay", entry, buildings, 100)).toMatchObject({ storageId: "warehouse", room: 3 });
    expect(physicalDeliveryStop("clay", entry, buildings, 100, 4)).toMatchObject({ storageId: "farm", room: 2 });
    expect(changeStorageLocations("clay", entry.locations, 4, buildings, 100)).toEqual({ farm: 4, warehouse: 10 });
    expect(() => changeStorageLocations("clay", entry.locations, 7, buildings, 100)).toThrow();
    expect(() => changeStorageLocations("clay", entry.locations, 4, buildings, 100, "warehouse")).toThrow();
  });
  it("shows local quantities rather than recomputing warehouse-first stock", () => {
    const display = sharedStorageAllocation("bread", 11, true, { farm: 8, warehouse: 3 }, "warehouse");
    expect(display.farm.quantity).toBe(8);
    expect(display.warehouse.quantity).toBe(3);
  });
  it("does not deposit in unfinished warehouses and supports multiple building IDs", () => {
    const future = [{ ...buildings[0]!, completesAt: 200 }];
    expect(changeStorageLocations("bread", { farm: 2 }, 1, future, 100)).toEqual({ farm: 3 });
    expect(changeStorageLocations("bread", { farm: 2, warehouse: 10 }, 1,
      [...buildings, { id: "warehouse2", type: "warehouse", completesAt: 0 }], 100)).toEqual({ farm: 2, warehouse: 10, warehouse2: 1 });
  });
  it("reserves space at the porter's actual destination, not whichever store is first", () => {
    const entry = { itemKey: "beer", quantity: 5, locations: { farm: 4, warehouse: 1 } };
    expect(physicalDeliveryStop("beer", entry, buildings, 100, { quantity: 2, storageId: "farm" })).toMatchObject({ storageId: "warehouse", room: 9 });
    expect(changeStorageLocations("beer", { farm: 0, warehouse: 9 }, 1, buildings, 100, undefined, { warehouse: 1 })).toEqual({ farm: 1, warehouse: 9 });
  });
});

it("stores sesame only in completed warehouses, respects reservations, and allows spending the final basket", () => {
  expect(changeStorageLocations("sesame", {}, 12, buildings, 100)).toEqual({ warehouse: 12 });
  expect(() => changeStorageLocations("sesame", {}, 13, buildings, 100)).toThrow("Not enough space");
  expect(() => changeStorageLocations("sesame", {}, 1, [], 100)).toThrow("Not enough space");
  expect(() => changeStorageLocations("sesame", {}, 1, [{ ...buildings[0]!, completesAt: 200 }], 100)).toThrow("Not enough space");
  for (const destination of ["farm", "granary", "missing"]) {
    expect(() => changeStorageLocations("sesame", {}, 1, buildings, 100, destination)).toThrow("completed warehouse");
  }
  expect(() => changeStorageLocations("sesame", { warehouse: 10 }, 2, buildings, 100, undefined, { warehouse: 1 })).toThrow();
  expect(changeStorageLocations("sesame", { warehouse: 3 }, -3, buildings, 100)).toEqual({ farm: 0, warehouse: 0 });
  expect(sharedStorageAllocation("sesame", 3, true, { warehouse: 3 }, "warehouse")).toEqual({ farm: { quantity: 0, capacity: 0 }, warehouse: { quantity: 3, capacity: 12 } });
});
