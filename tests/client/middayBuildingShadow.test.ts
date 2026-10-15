import { expect, it } from "vitest";
import { middayBuildingOval, middayShadowWeight } from "../../src/client/game/phaser/buildingShadowProjection";

it("uses only the contact oval at midday and preserves morning, evening and night", () => {
  expect(middayShadowWeight(14)).toBe(1);
  for (const hour of [0, 9, 11, 17, 19, 22]) expect(middayShadowWeight(hour)).toBe(0);
  expect(middayShadowWeight(12.5)).toBe(0.5);
  expect(middayShadowWeight(15.5)).toBe(0.5);
});

it("anchors a shallow oval to artwork, ignoring transparent horizontal padding", () => {
  const sprite = { x: 100, y: 200, originX: 0.5, originY: 1, displayWidth: 100, displayHeight: 100 };
  const contour = Array.from({ length: 100 }, (_, x) => x >= 10 && x < 90 ? 90 : 0);
  const oval = middayBuildingOval(sprite, { width: 100, height: 100, bottom: 90, contour })!;
  expect(oval.x).toBe(100);
  expect(oval.x - oval.radiusX).toBe(54); // six pixels beyond the artwork's left edge
  expect(oval.x + oval.radiusX).toBe(146); // and right edge
  expect(oval.y + oval.radiusY).toBeCloseTo(196); // six pixels below its visible base
  expect(oval.radiusY).toBeLessThan(oval.radiusX / 2);
});

it("does not draw an oval for empty artwork", () => {
  expect(middayBuildingOval({ x: 0, y: 0, originX: 0.5, originY: 1, displayWidth: 100, displayHeight: 100 },
    { width: 100, height: 100, bottom: 100, contour: Array(100).fill(0) })).toBeNull();
});
