import { expect, it } from "vitest";
import { farmerObscured, hiddenFarmerBounce, type OcclusionSprite } from "../../src/client/game/phaser/farmerOcclusion";
const farmer: OcclusionSprite = { left: 20, top: 20, width: 20, height: 40, depth: 1, opaqueAt: () => true };
const building: OcclusionSprite = { left: 0, top: 0, width: 100, height: 100, depth: 2, opaqueAt: () => true };
it("detects full and partial obstruction only by buildings drawn in front", () => {
  expect(farmerObscured(farmer, [building])).toBe(true);
  expect(farmerObscured(farmer, [{ ...building, left: 30 }])).toBe(true);
  expect(farmerObscured(farmer, [{ ...building, depth: 0 }])).toBe(false);
  expect(farmerObscured(farmer, [{ ...building, left: 50 }])).toBe(false);
  expect(farmerObscured(farmer, [])).toBe(false);
});
it("ignores transparent artwork on either sprite", () => {
  expect(farmerObscured(farmer, [{ ...building, opaqueAt: () => false }])).toBe(false);
  expect(farmerObscured({ ...farmer, opaqueAt: () => false }, [building])).toBe(false);
  expect(farmerObscured(farmer, [{ ...building, opaqueAt: (u, v) => u > 0.8 && v > 0.8 }])).toBe(false);
});
it("uses world coordinates consistently after a shared translation or zoom", () => {
  const transform = (s: OcclusionSprite) => ({ ...s, left: s.left * 2 + 100, top: s.top * 2 - 80, width: s.width * 2, height: s.height * 2 });
  expect(farmerObscured(transform(farmer), [transform(building)])).toBe(true);
});
it("bounces gently and remains still for reduced motion", () => {
  expect(hiddenFarmerBounce(0, false)).toBeCloseTo(0);
  expect(hiddenFarmerBounce(450, false)).toBe(-5);
  expect(hiddenFarmerBounce(900, false)).toBeCloseTo(0);
  expect(hiddenFarmerBounce(450, true)).toBe(0);
});
