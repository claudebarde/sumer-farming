import { describe, expect, it } from "vitest";
import { barleyDeliveryBuilding, sharedDeliveryStop } from "../../src/game-core/farm/storageDelivery";
describe("delivery storage priorities", () => {
  it("fills the granary before warehouse regardless of creation order, then falls back to farm", () => {
    const warehouse = { type: "warehouse", completesAt: new Date(0).toISOString(), storedBarley: 0 };
    const granary = { ...warehouse, type: "granary", storedBarley: 19 };
    expect(barleyDeliveryBuilding([warehouse, granary], 7, 100)).toBe(granary);
    expect(barleyDeliveryBuilding([warehouse, { ...granary, storedBarley: 20 }], 7, 100)).toBe(warehouse);
    expect(barleyDeliveryBuilding([{ ...warehouse, storedBarley: 20 }, { ...granary, storedBarley: 20 }], 7, 100)).toBeUndefined();
    expect(barleyDeliveryBuilding([{ ...warehouse, completesAt: new Date(200).toISOString() }], 7, 100)).toBeUndefined();
    expect(barleyDeliveryBuilding([{ ...granary, storedBarley: 15 }], 6, 100)).toBeUndefined();
  });
  it.each(["bread", "beer", "flour", "brewersGroats", "reed", "clay"])("routes %s to warehouse then farm", item => {
    expect(sharedDeliveryStop(item, 9, true)).toEqual({ location: "warehouse", room: 1 });
    expect(sharedDeliveryStop(item, 10, true)).toEqual({ location: "farm", room: item === "reed" || item === "clay" ? 6 : 10 });
    expect(sharedDeliveryStop(item, 20, true).room).toBe(0);
    expect(sharedDeliveryStop(item, 0, false).location).toBe("farm");
  });
  it("always stores fish at the farm", () => {
    expect(sharedDeliveryStop("fish", 4, true)).toEqual({ location: "farm", room: 1 });
  });
});
