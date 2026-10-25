import { walkingCharacterDepth, farmerObscured } from "../../src/client/game/phaser/farmerOcclusion";
import { expect, it } from "vitest";
import { farmerDateCarryTexture, FARMER_DATE_SOURCES, FARMER_DATE_DISPLAY_SIZE } from "../../src/client/game/phaser/farmerDateCarry";

it("uses walking depth so buildings hide the carrier and trigger the yellow marker", () => {
  const building = { left: 0, top: 0, width: 80, height: 80, depth: 260, opaqueAt: () => true };
  for (const y of [120, 220, 320, 220, 120]) {
    const carrier = { left: 0, top: 0, width: 50, height: 60,
      depth: walkingCharacterDepth(y), opaqueAt: () => true };
    expect(carrier.depth).toBe(y + 1);
    expect(farmerObscured(carrier, [building])).toBe(y < 260);
  }
});

it("uses the visually adjusted delivery sprite size", () => {
  expect(FARMER_DATE_DISPLAY_SIZE).toBe(77);
});

it("cycles through all four walking frames and keeps the corrected idle sprite", () => {
  expect([0,160,320,480,640].map(t => farmerDateCarryTexture(t))).toEqual([
    "farmer-dates-walk-0", "farmer-dates-walk-1", "farmer-dates-walk-2", "farmer-dates-walk-3", "farmer-dates-walk-0"
  ]);
  expect(FARMER_DATE_SOURCES["farmer-dates-idle"]).toContain("idle-v2.png");
  expect(farmerDateCarryTexture(500, false)).toBe("farmer-dates-idle");
});
