import { expect, it } from "vitest";
import { morningMillOval, opaqueTop, usesMorningMillOval } from "../../src/client/game/phaser/buildingShadowProjection";
import { daylightShadow, shadowEllipse } from "../../src/client/game/phaser/daylightShadows";

it("changes only the mill body and bags in the morning", () => {
  for (const key of ["mill-v1-base", "mill-v1-bags"]) {
    expect(usesMorningMillOval(key, 9)).toBe(true);
    for (const hour of [7, 14, 19, 22]) expect(usesMorningMillOval(key, hour)).toBe(false);
  }
  for (const key of ["granary", "breadOven", "mill-v1-bowl", "mill-v1-lever"]) {
    expect(usesMorningMillOval(key, 9)).toBe(false);
  }
});

it("uses shared shadow length and excludes transparent artwork padding", () => {
  const sun = daylightShadow(9);
  const sprite = { x: 100, y: 200, originX: 0.5, originY: 1, displayWidth: 100, displayHeight: 100 };
  const contour = Array.from({ length: 100 }, (_, x) => x >= 10 && x < 90 ? 90 : 0);
  const oval = morningMillOval(sun, sprite, { width: 100, height: 100, top: 40, bottom: 90, contour })!;
  const expected = shadowEllipse(sun, 80, 50);
  expect(oval.width).toBe(expected.width);
  expect(oval.height).toBe(expected.height);
  expect(oval.rotation).toBe(expected.rotation);
  expect(oval.x).toBeCloseTo(100 + expected.x);
  expect(oval.y).toBeCloseTo(190 - 80 * 0.16 + expected.y);
});

it("finds visible top once and ignores nearly transparent pixels", () => {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  pixels[3] = 10;
  pixels[(2 * 4 + 1) * 4 + 3] = 255;
  expect(opaqueTop(pixels, 4, 4)).toBe(2);
});
