import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BuildingStorageTables from "../../src/client/components/BuildingStorageTables";
import { sharedStorageAllocation } from "../../src/game-core/farm/storageDisplay";
import { ESTATE_STORAGE_LIMITS } from "../../src/game-data/storage";

describe("building storage displays", () => {
  it.each(Object.keys(ESTATE_STORAGE_LIMITS) as (keyof typeof ESTATE_STORAGE_LIMITS)[])("allocates %s warehouse-first without double counting", item => {
    const capacity = ESTATE_STORAGE_LIMITS[item];
    for (const quantity of [0, capacity - 1, capacity, capacity + 4, capacity + 10, capacity + 15]) {
      const result = sharedStorageAllocation(item, quantity, true);
      expect(result.farm.quantity).toBe(Math.max(0, quantity - 10));
      expect(result.warehouse.quantity).toBe(Math.min(quantity, 10));
      expect(result.farm.quantity + result.warehouse.quantity).toBe(quantity);
      expect(result.warehouse.capacity).toBe(10);
    }
  });
  it("does not allocate to an unfinished or absent warehouse, preserving old excess stock", () => {
    expect(sharedStorageAllocation("bread", 24, false)).toEqual({ farm: { quantity: 24, capacity: 10 }, warehouse: { quantity: 0, capacity: 0 } });
  });
  it("renders matching compact tables with local counts and capacities", () => {
    const inventory = [{ itemKey: "bread" as const, quantity: 14 }, { itemKey: "reed" as const, quantity: 8 }];
    const farm = renderToStaticMarkup(createElement(BuildingStorageTables, { location: "farm", inventory, barley: 3, warehouseComplete: true, showFish: true }));
    const warehouse = renderToStaticMarkup(createElement(BuildingStorageTables, { location: "warehouse", inventory, barley: 7, warehouseComplete: true }));
    expect(farm.match(/<table /g)).toHaveLength(2);
    expect(warehouse.match(/<table /g)).toHaveLength(2);
    expect(farm).toContain("4/10");
    expect(farm).toContain("0/6");
    expect(farm).toContain("3/5");
    expect(warehouse).toContain("10/10");
    expect(warehouse).toContain("8/10");
    expect(warehouse).toContain("7/20");
    expect(warehouse).not.toContain("14/20");
    expect(farm).toContain(">Fish</th>");
    expect(farm.split("</table>")[0]).not.toContain(">Fish</th>");
    expect(farm).toContain('>Barley</th><th scope="col">Fish</th><th scope="col">Reed</th>');
    expect(warehouse).not.toContain(">Fish</th>");
  });
});
