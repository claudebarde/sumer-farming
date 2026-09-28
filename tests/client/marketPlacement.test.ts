import { describe, expect, it } from "vitest";
import { getMarketPosition } from "../../src/client/game/phaser/marketPlacement";

describe("market placement", () => {
  it("places the full two-tile building flush against a fractional right edge", () => {
    expect(getMarketPosition(1050, 800, 100, [])).toEqual({ x: 850, y: 300 });
  });

  it("moves sideways instead of leaving a gap above the road", () => {
    expect(getMarketPosition(1000, 800, 100, [
      { x: 800, y: 300, width: 100, height: 100 }
    ])).toEqual({ x: 600, y: 300 });
  });

  it("checks partial tile overlaps", () => {
    expect(getMarketPosition(1050, 800, 100, [
      { x: 800, y: 300, width: 100, height: 100 }
    ])).toEqual({ x: 550, y: 300 });
  });

  it("stays beside the road even when all rows at the right edge are occupied", () => {
    expect(getMarketPosition(1000, 800, 100, [
      { x: 800, y: 200, width: 200, height: 600 }
    ])).toEqual({ x: 600, y: 300 });
  });

  it("moves inward if the whole edge is occupied", () => {
    expect(getMarketPosition(1000, 800, 100, [
      { x: 900, y: 0, width: 100, height: 800 }
    ])).toEqual({ x: 700, y: 300 });
  });

  it("keeps the building inside a short canvas", () => {
    expect(getMarketPosition(1000, 250, 100, [])).toEqual({ x: 800, y: 50 });
  });

  it("keeps its bottom aligned with the road across canvas widths", () => {
    for (const width of [800, 1050, 1400]) {
      expect(getMarketPosition(width, 1600, 100, []).y + 200).toBe(500);
    }
  });
});
