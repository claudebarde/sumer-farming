import { describe, expect, it } from "vitest";
import { advanceMarketVisitor, marketVisitorPath } from "../../src/client/game/phaser/marketVisitorMotion";
import { isMarketRoad } from "../../src/game-data/marketLayout";
import { MarketPositionSchema } from "../../src/schemas/marketPresence";

describe("isometric market visitor movement", () => {
  it("accepts fractional road positions and rejects stall interiors", () => {
    for (const position of [{ column: -2.5, row: 5 }, { column: 9, row: 8.4 }, { column: 3.2, row: 11 }])
      expect(MarketPositionSchema.safeParse(position).success).toBe(true);
    expect(MarketPositionSchema.safeParse({ column: 3, row: 8 }).success).toBe(false);
  });
  it("follows corners instead of crossing the market interior", () => {
    let position = { column: 8.5, row: 5 };
    let path = marketVisitorPath(position, { column: 9, row: 7.5 });
    expect(path).toContainEqual({ column: 9, row: 5 });
    for (let i = 0; i < 40; i++) {
      const next = advanceMarketVisitor(position, path, 0.1);
      expect(isMarketRoad(next.position)).toBe(true);
      position = next.position; path = next.path;
    }
    expect(position).toEqual({ column: 9, row: 7.5 });
    expect(path).toHaveLength(0);
  });
  it("handles stationary, reverse and long routes without leaving roads", () => {
    expect(marketVisitorPath({ column: 0, row: 5 }, { column: 0, row: 5 })).toEqual([]);
    const path = marketVisitorPath({ column: 9, row: 8.5 }, { column: 0, row: 8.5 });
    let position = { column: 9, row: 8.5 }, remaining = path;
    for (let i = 0; i < 200; i++) {
      const next = advanceMarketVisitor(position, remaining, 0.1);
      expect(isMarketRoad(next.position)).toBe(true);
      position = next.position; remaining = next.path;
    }
    expect(position).toEqual({ column: 0, row: 8.5 });
  });
});
