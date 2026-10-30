import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BuildingStorageTables from "../../src/client/components/BuildingStorageTables";
import { sharedStorageAllocation } from "../../src/game-core/farm/storageDisplay";
import { ESTATE_STORAGE_LIMITS } from "../../src/game-data/storage";

describe("building storage displays", () => {
  it("uses the same visual cards for warehouse-local stock, including unlocked dates", () => {
    const html = renderToStaticMarkup(createElement(BuildingStorageTables, {
      location: "warehouse", visual: true, showDates: true, barley: 7, warehouseComplete: true,
      inventory: [{ itemKey: "bread", quantity: 14 }, { itemKey: "dates", quantity: 4 }]
    }));
    expect(html).toContain('aria-label="warehouse inventory"');
    expect(html.match(/<progress /g)).toHaveLength(8);
    expect(html).toContain("10/10");
    expect(html).toContain("7/20");
    expect(html).toContain("4/5");
    expect(html).toContain('width="36" height="36"');
    expect(html).not.toContain("14/20");
    expect(html).not.toContain("Fish storage");
    expect(html).not.toContain("<table");
  });
  it("renders the farm visual inventory with eight icons, names, capacity bars and counts", () => {
    const html = renderToStaticMarkup(createElement(BuildingStorageTables, {
      location: "farm", visual: true, showFish: true, barley: 3, warehouseComplete: false,
      inventory: [{ itemKey: "bread", quantity: 6 }, { itemKey: "beer", quantity: 5 }, { itemKey: "fish", quantity: 1 }]
    }));
    expect(html).toContain('aria-label="farm inventory"');
    expect(html.match(/<progress /g)).toHaveLength(8);
    expect(html.match(/<img /g)).toHaveLength(8);
    expect(html).toContain("brewers-groats-icon.webp");
    expect(html).toContain("mill-flour-bags-isometric.webp");
    for (const count of ["6/10", "5/10", "0/10", "3/5", "1/5", "0/6"]) expect(html).toContain(count);
    expect(html).toContain('aria-label="Bread storage" aria-valuetext="6 of 10"');
    expect(html).not.toContain("<table");
  });
  it("clamps a full visual bar without hiding legacy excess stock", () => {
    const html = renderToStaticMarkup(createElement(BuildingStorageTables, {
      location: "farm", visual: true, barley: 0, warehouseComplete: false,
      inventory: [{ itemKey: "bread", quantity: 12 }]
    }));
    expect(html).toContain('value="10" max="10" aria-label="Bread storage"');
    expect(html).toContain("12/10");
  });
  it("shows date baskets only in the warehouse with a five-basket capacity", () => {
    const inventory = [{ itemKey: "dates" as const, quantity: 4 }];
    const farm = renderToStaticMarkup(createElement(BuildingStorageTables, { location: "farm", inventory, barley: 0, warehouseComplete: true, showDates: true }));
    const warehouse = renderToStaticMarkup(createElement(BuildingStorageTables, { location: "warehouse", inventory, barley: 0, warehouseComplete: true, showDates: true }));
    expect(farm).not.toContain("Date baskets");
    expect(warehouse).toContain(">Date baskets</th>"); expect(warehouse).toContain("4/5");
    expect(sharedStorageAllocation("dates", 8, true)).toEqual({ farm: { quantity: 0, capacity: 0 }, warehouse: { quantity: 8, capacity: 5 } });
  });
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

it("shows sesame only in its unlocked warehouse card", () => {
  const base = { inventory: [{ itemKey: "sesame" as const, quantity: 3, locations: { warehouse: 3 } }], warehouseId: "warehouse", barley: 0, warehouseComplete: true, visual: true };
  const warehouse = renderToStaticMarkup(createElement(BuildingStorageTables, { ...base, location: "warehouse", showSesame: true }));
  expect(warehouse).toContain("sesame-basket-isometric.png");
  expect(warehouse).toContain("3/12");
  for (const props of [{ location: "farm" as const, showSesame: true }, { location: "warehouse" as const, showSesame: false }]) {
    expect(renderToStaticMarkup(createElement(BuildingStorageTables, { ...base, ...props }))).not.toContain("Sesame");
  }
});
