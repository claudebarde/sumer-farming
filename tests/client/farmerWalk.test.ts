import { describe, expect, it } from "vitest";
import { FARMER_WALK_CYCLE, farmerWalkTexture } from "../../src/client/game/phaser/farmerWalk";

describe("farmer walking cycle", () => {
  it("loops continuously through forward and return poses", () => {
    expect(Array.from({ length: 11 }, (_, i) => farmerWalkTexture(i * 7))).toEqual(
      [...FARMER_WALK_CYCLE, 0].map(i => `farmer-walk-v2-${i}`)
    );
  });
  it("holds its pose when travel pauses and guards negative distance", () => {
    expect(farmerWalkTexture(6.9)).toBe(farmerWalkTexture(0));
    expect(farmerWalkTexture(-1)).toBe(farmerWalkTexture(0));
  });
});
