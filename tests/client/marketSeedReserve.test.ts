import { describe, expect, it } from "vitest";
import { BARLEY_RESERVE_MESSAGE, violatesBarleyReserve } from "../../src/game-core/farm/marketSeedReserve";
import { clampMarketQuantity, marketQuantityLimit } from "../../src/client/game/marketQuantity";

describe("barley market reserve", () => {
  it("allows selecting 20 of 20 so the confirmation can explain the restriction", () => {
    const limit = marketQuantityLimit("sell", 20);
    expect(clampMarketQuantity(20, limit)).toBe(20);
    expect(violatesBarleyReserve("barley", 20, 19)).toBe(false);
    expect(violatesBarleyReserve("barley", 20, 20)).toBe(true);
    expect(BARLEY_RESERVE_MESSAGE).toBe("You must keep 1 barley in your farm");
  });
  it("protects the last barley and rejects overselling", () => {
    expect(violatesBarleyReserve("barley", 1, 1)).toBe(true);
    expect(violatesBarleyReserve("barley", 0, 1)).toBe(true);
    expect(violatesBarleyReserve("barley", 20, 21)).toBe(true);
  });
  it("does not reserve other goods", () => {
    expect(violatesBarleyReserve("bread", 20, 20)).toBe(false);
  });
});
