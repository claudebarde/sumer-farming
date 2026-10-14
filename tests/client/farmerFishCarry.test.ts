import { describe, expect, it } from "vitest";
import { FARMER_FISH_SOURCES, farmerFishCarryTexture } from "../../src/client/game/phaser/farmerFishCarry";

describe("fish carrying presentation", () => {
  it("alternates the two walking poses at the approved carrying cadence", () => {
    expect(Object.keys(FARMER_FISH_SOURCES)).toHaveLength(3);
    expect(farmerFishCarryTexture(-1, true)).toBe("farmer-fish-walk-0");
    expect(farmerFishCarryTexture(34, true)).toBe("farmer-fish-walk-0");
    expect(farmerFishCarryTexture(35, true)).toBe("farmer-fish-walk-1");
    expect(farmerFishCarryTexture(70, true)).toBe("farmer-fish-walk-0");
  });
  it("uses the holding pose when stopped or delivering, regardless of stride", () => {
    expect(farmerFishCarryTexture(0, false)).toBe("farmer-fish-idle");
    expect(farmerFishCarryTexture(35, false)).toBe("farmer-fish-idle");
  });
});
