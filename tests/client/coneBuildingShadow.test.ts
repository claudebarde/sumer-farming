import { expect, it } from "vitest";
import { coneShadowProfile, coneBuildingShadowShape, usesConeBuildingShadow } from "../../src/client/game/phaser/coneBuildingShadow";

it("covers the small shrine and both brewery orientations and vessel counts", () => {
  for (const key of ["smallShrine", "brewery", "brewery-0", "brewery-1", "brewery-right-top-full", "brewery-right-top-full-0", "brewery-right-top-full-1"]) expect(usesConeBuildingShadow(key)).toBe(true);
  for (const key of ["farm-level-1", "warehouse", "breadOven", "mill-v1-base"]) expect(usesConeBuildingShadow(key)).toBe(false);
});
it("shortens at midday, fades at night and follows the shared sun smoothly", () => {
  const morning = coneBuildingShadowShape(9, 100, 100), noon = coneBuildingShadowShape(14, 100, 100), evening = coneBuildingShadowShape(19, 100, 100);
  expect(morning.length).toBeGreaterThan(noon.length);
  expect(evening.length).toBeGreaterThan(noon.length);
  expect(morning.y).toBeLessThan(0);
  expect(evening.y).toBeGreaterThan(0);
  expect(coneBuildingShadowShape(22, 100, 100).length).toBe(0);
  expect(coneBuildingShadowShape(13.999, 100, 100).length).toBeCloseTo(noon.length, 1);
  expect(noon.length).toBeLessThan(noon.base);
});

it("projects the cone as a base circle with tangent sides to its apex", () => {
  expect(coneShadowProfile(50, 0).tangentAngle).toBeNull();
  expect(coneShadowProfile(50, 50).tangentAngle).toBeNull();
  const angle = coneShadowProfile(50, 100).tangentAngle!;
  const x = 50 * Math.cos(angle), y = 50 * Math.sin(angle);
  expect(Math.hypot(x, y)).toBeCloseTo(50);
  // Radius and tangent edge must meet at a right angle.
  expect(x * (100 - x) - y * y).toBeCloseTo(0);
  expect(coneShadowProfile(50, 50.00001).tangentAngle).toBeCloseTo(0, 2);
});
