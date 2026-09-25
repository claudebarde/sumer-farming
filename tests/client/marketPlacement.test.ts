import { describe, expect, it } from "vitest";
import { getMarketPosition } from "../../src/client/game/phaser/marketPlacement";

describe("market placement", () => {
  it("places the full two-tile building flush against a fractional right edge", () => {
    expect(getMarketPosition(1050, 800, 100, [])).toEqual({ x: 850, y: 200 });
  });

  it("moves down until both columns and both rows clear an obstacle", () => {
    expect(getMarketPosition(1000, 800, 100, [
      { x: 800, y: 300, width: 100, height: 100 }
    ])).toEqual({ x: 800, y: 400 });
  });

  it("checks partial tile overlaps", () => {
    expect(getMarketPosition(1050, 800, 100, [
      { x: 800, y: 200, width: 100, height: 100 }
    ])).toEqual({ x: 850, y: 300 });
  });

  it("tries rows above before moving away from the edge", () => {
    expect(getMarketPosition(1000, 800, 100, [
      { x: 800, y: 200, width: 200, height: 600 }
    ])).toEqual({ x: 800, y: 0 });
  });

  it("moves inward if the whole edge is occupied", () => {
    expect(getMarketPosition(1000, 800, 100, [
      { x: 900, y: 0, width: 100, height: 800 }
    ])).toEqual({ x: 700, y: 200 });
  });

  it("keeps the building inside a short canvas", () => {
    expect(getMarketPosition(1000, 250, 100, [])).toEqual({ x: 800, y: 0 });
  });
});
