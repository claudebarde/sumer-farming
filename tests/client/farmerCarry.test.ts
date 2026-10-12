import { describe, expect, it } from "vitest";
import { FARMER_CARRY_SOURCES, farmerTravelTexture } from "../../src/client/game/phaser/farmerCarry";
import { farmerWalkTexture } from "../../src/client/game/phaser/farmerWalk";

describe("barley carrying presentation", () => {
  it("alternates two poses over the approved full walking stride", () => {
    expect(FARMER_CARRY_SOURCES).toHaveLength(2);
    expect(farmerTravelTexture(0, 2, true)).toBe("farmer-carry-v2-0");
    expect(farmerTravelTexture(34, 2, true)).toBe("farmer-carry-v2-0");
    expect(farmerTravelTexture(35, 2, true)).toBe("farmer-carry-v2-1");
    expect(farmerTravelTexture(70, 2, true)).toBe("farmer-carry-v2-0");
    expect(farmerTravelTexture(-1, 2, true)).toBe("farmer-carry-v2-0");
  });
  it("keeps holding surplus when stopped and puts it away after delivery", () => {
    expect(farmerTravelTexture(35, 2, false)).toBe("farmer-carry-v2-0");
    expect(farmerTravelTexture(35, 0, false)).toBe("farmer-idle");
  });
  it("keeps the normal walk when empty-handed", () => {
    expect(farmerTravelTexture(35, 0, true)).toBe(farmerWalkTexture(35));
  });
});
