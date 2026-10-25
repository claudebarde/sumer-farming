import { describe, expect, it } from "vitest";
import { isGatherableRiverbank } from "../../src/game-core/farm/worldBounds";

describe("riverbank gathering bounds", () => {
  it.each([-4, 11])("allows the actual world edge at column %i", column => {
    expect(isGatherableRiverbank({ column, row: 9 })).toBe(true);
  });
  it.each([-5, 12, 16])("rejects decorative riverbank column %i", column => {
    expect(isGatherableRiverbank({ column, row: 9 })).toBe(false);
  });
  it("rejects river water and tiles away from the bank", () => {
    expect(isGatherableRiverbank({ column: 5, row: 10 })).toBe(false);
    expect(isGatherableRiverbank({ column: 5, row: 8 })).toBe(false);
  });
});
