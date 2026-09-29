import { describe, expect, it } from "vitest";
import { isCarryingForMarket } from "../../src/client/game/phaser/marketEntry";

describe("market entry with carried goods", () => {
  it("allows empty hands", () => {
    expect(isCarryingForMarket(null, false, false)).toBe(false);
  });
  it.each([1, 2, 10])("blocks a carried stack of %i items", quantity => {
    expect(isCarryingForMarket({ quantity }, false, false)).toBe(true);
  });
  it("blocks the mixed Mill bag delivery", () => {
    expect(isCarryingForMarket(null, true, false)).toBe(true);
  });
  it("blocks barley being carried visually to the Mill", () => {
    expect(isCarryingForMarket(null, false, true)).toBe(true);
  });
});
