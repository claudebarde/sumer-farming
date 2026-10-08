import { describe, expect, it } from "vitest";
import { clampMarketQuantity, marketQuantityLimit } from "../../src/client/game/marketQuantity";

describe("market sale quantities", () => {
  it("caps both typed and incremented quantities at available stock", () => {
    const limit = marketQuantityLimit("sell", 9);
    expect(limit).toBe(9);
    expect(clampMarketQuantity(10, limit)).toBe(9);
    expect(clampMarketQuantity(999, limit)).toBe(9);
    expect(clampMarketQuantity(8, limit)).toBe(8);
  });
  it("reclamps a saved selection when stock decreases after a sale or refresh", () => {
    expect(clampMarketQuantity(9, marketQuantityLimit("sell", 3))).toBe(3);
  });
  it("keeps the empty-stock placeholder positive so existing sale validation blocks it", () => {
    expect(clampMarketQuantity(9, marketQuantityLimit("sell", 0))).toBe(1);
  });
  it("preserves purchase limits independently of stock", () => {
    expect(marketQuantityLimit("buy", 0)).toBeUndefined();
    expect(clampMarketQuantity(10, marketQuantityLimit("buy", 0))).toBe(10);
    expect(clampMarketQuantity(10, marketQuantityLimit("buy", 0, 2))).toBe(2);
  });
  it.each([NaN, Infinity, -1, 0])("normalizes invalid quantity %s", quantity => {
    expect(clampMarketQuantity(quantity, 9)).toBe(1);
  });
});
