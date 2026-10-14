import { expect, it } from "vitest";
import { FARMER_FLOUR_SOURCES, farmerFlourBounds, farmerFlourCarryTexture } from "../../src/client/game/phaser/farmerFlourCarry";

it("uses the approved two-pose carrying cadence and a stationary holding pose", () => {
  expect(Object.keys(FARMER_FLOUR_SOURCES)).toHaveLength(3);
  expect(farmerFlourCarryTexture(-1, true)).toBe("farmer-flour-walk-0");
  expect(farmerFlourCarryTexture(34, true)).toBe("farmer-flour-walk-0");
  expect(farmerFlourCarryTexture(35, true)).toBe("farmer-flour-walk-1");
  expect(farmerFlourCarryTexture(70, true)).toBe("farmer-flour-walk-0");
  expect(farmerFlourCarryTexture(35, false)).toBe("farmer-flour-idle");
});

it("keeps walking frames registered together and handles the differently sized idle export", () => {
  expect(farmerFlourBounds("farmer-flour-walk-0")).toEqual(farmerFlourBounds("farmer-flour-walk-1"));
  expect(farmerFlourBounds("farmer-flour-idle").right).toBe(705);
});
