import { describe, expect, it } from "vitest";
import { getCarryBubblePosition } from "../../src/client/game/phaser/carryBubblePosition";

describe("carrying bubble position", () => {
  it("preserves the normal offset away from edges", () => {
    const position = getCarryBubblePosition(100, 100, 64, 800, 600);
    expect(position.x).toBeCloseTo(149.92);
    expect(position.y).toBeCloseTo(105.12);
  });
  it("keeps the whole bubble and outline visible on the top row", () => {
    const position = getCarryBubblePosition(100, 0, 64, 800, 600);
    expect(position.x).toBeCloseTo(149.92);
    expect(position.y).toBeCloseTo(5.12);
  });
  it("also protects the right and bottom edges", () => {
    expect(getCarryBubblePosition(790, 599, 64, 800, 600)).toEqual({ x: 786, y: 522 });
  });
  it("centres the bubble if the canvas is smaller than its diameter", () => {
    expect(getCarryBubblePosition(0, 0, 64, 20, 20)).toEqual({ x: 10, y: -54 });
  });
  it("keeps the same head-relative offset on top-row roads and lower rows", () => {
    for (const farmerY of [-32, 32, 96]) {
      const position = getCarryBubblePosition(100, farmerY, 64, 800, 600);
      expect(position.x - 100).toBeCloseTo(64 * 0.78);
      expect(position.y - farmerY).toBeCloseTo(64 * 0.08);
    }
  });
});
