import { describe, expect, it } from "vitest";
import { FARM_BUILDING_DEFINITIONS } from "../../src/game-data/buildings";
import { calculateFarmStorageCapacity, estateResourceCapacity } from "../../src/game-data/storage";
import { commandUnlockLevel } from "../../src/game-core/farm/commandUnlock";

describe("warehouse balance", () => {
  const warehouse = { type: "warehouse" as const, completesAt: new Date(1000) };
  it("has independent limits and only increases them when completed", () => {
    for (const item of ["bread", "beer", "flour", "brewersGroats", "reed", "clay"] as const) {
      const base = item === "reed" || item === "clay" ? 6 : 10;
      expect(estateResourceCapacity(item, [], 1000)).toBe(base);
      expect(estateResourceCapacity(item, [warehouse], 999)).toBe(base);
      expect(estateResourceCapacity(item, [warehouse], 1000)).toBe(base + 10);
    }
    expect(estateResourceCapacity("fish", [warehouse], 1000)).toBe(5);
    expect(calculateFarmStorageCapacity([{ type: "granary", completesAt: new Date(0) }, warehouse], 1000, 8)).toBe(45);
  });
  it("fits every construction cost within pre-warehouse material limits", () => {
    for (const building of Object.values(FARM_BUILDING_DEFINITIONS)) {
      expect(building.materials.reed).toBeLessThanOrEqual(6);
      expect(building.materials.clay).toBeLessThanOrEqual(6);
    }
    expect(FARM_BUILDING_DEFINITIONS.warehouse.footprint).toEqual({ columns: 2, rows: 2 });
    expect(commandUnlockLevel({ type: "build_warehouse", target: { column: 0, row: 0 }, expectedFarmVersion: 1 })).toBe(8);
  });
});
