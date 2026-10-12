import { describe, expect, it } from "vitest";
import { farmerPlantBounds, farmerPlantTexture, FARMER_PLANT_FRAME_MS } from "../../src/client/game/phaser/farmerPlant";

describe("farmer planting presentation", () => {
  it("plays ready, reach, scatter, reach, ready without duplicating endpoints", () => {
    expect(Array.from({ length: 5 }, (_, i) => farmerPlantTexture(i * FARMER_PLANT_FRAME_MS)))
      .toEqual([0, 1, 2, 1, 0].map(i => `farmer-plant-v2-${i}`));
  });
  it("holds each pose and starts safely at the ready frame", () => {
    expect(farmerPlantTexture(319)).toBe(farmerPlantTexture(0));
    expect(farmerPlantTexture(-1)).toBe(farmerPlantTexture(0));
  });
  it("preserves normalized framing across source resolutions", () => {
    expect(farmerPlantBounds(512)).toEqual({ left: 32, top: 32, right: 479, bottom: 479 });
    const larger = farmerPlantBounds(1254);
    expect(larger.left / 1254).toBeCloseTo(32 / 512, 3);
    expect((larger.bottom + 1) / 1254).toBeCloseTo(480 / 512, 3);
  });
});
