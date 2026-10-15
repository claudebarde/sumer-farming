import { describe, expect, it } from "vitest";
import { BUILDING_SHADOW_CONTACT_ROWS, buildingShadowBottom, buildingShadowContourBottom, buildingShadowTransform, opaqueBaseContour, opaqueBottom, usesBuildingBaseContour } from "../../src/client/game/phaser/buildingShadowProjection";
import { daylightShadow } from "../../src/client/game/phaser/daylightShadows";

describe("artwork-shaped building shadows", () => {
  it("extracts the stepped ground contour without transparent padding or faint pixels", () => {
    const pixels = new Uint8ClampedArray(4 * 8 * 4);
    pixels[(3 * 4) * 4 + 3] = 255;
    pixels[(5 * 4 + 1) * 4 + 3] = 255;
    pixels[(4 * 4 + 2) * 4 + 3] = 255;
    pixels[(7 * 4) * 4 + 3] = 8;
    expect(opaqueBaseContour(pixels, 4, 8)).toEqual([4, 6, 5, 0]);
  });
  it("pins every evening base corner to its matching artwork pixel", () => {
    const sprite = { x: 100, y: 200, displayWidth: 232, displayHeight: 232, originX: 0.5, originY: 1 };
    const sun = daylightShadow(19);
    for (const [x, y] of [[25, 180], [130, 225], [230, 181]] as const) {
      const contact = buildingShadowContourBottom(y, 225, sun);
      const m = buildingShadowTransform(sun, sprite, { width: 256, height: 256, bottom: contact });
      expect(m.a * x + m.c * y + m.e).toBeCloseTo(sprite.x + (x / 256 - sprite.originX) * sprite.displayWidth);
      expect(m.b * x + m.d * y + m.f).toBeCloseTo(sprite.y + (y / 256 - sprite.originY) * sprite.displayHeight);
    }
    expect(buildingShadowContourBottom(180, 225, daylightShadow(9))).toBe(225);
    expect(buildingShadowContourBottom(180, 225, daylightShadow(22))).toBe(225);
  });
  it("uses contour hinges for the farmhouse, market and individual mill parts", () => {
    for (const key of ["farm-level-1", "farm-level-3", "farm-level-4", "farm-level-9", "market-preview", "mill-v1-base", "mill-v1-bags"]) expect(usesBuildingBaseContour(key)).toBe(true);
    for (const key of ["breadOven", "mill", "granary", "market-barley"]) expect(usesBuildingBaseContour(key)).toBe(false);
  });
  it("anchors the evening oven to the masonry rather than the foreground bread tray", () => {
    const sun = daylightShadow(19);
    expect(buildingShadowBottom("breadOven", 230, 256, sun)).toBeCloseTo(256 * 0.76);
    expect(buildingShadowBottom("breadOven", 230, 256, daylightShadow(9))).toBe(230);
    expect(buildingShadowBottom("breadOven", 230, 256, daylightShadow(14))).toBe(230);
    expect(buildingShadowBottom("breadOven", 230, 256, daylightShadow(22))).toBe(230);
    expect(buildingShadowBottom("mill", 230, 256, sun)).toBe(230);
    const sprite = { x: 0, y: 0, displayWidth: 150, displayHeight: 150, originX: 0.5, originY: 120 / 128 };
    const old = buildingShadowTransform(sun, sprite, { width: 256, height: 256, bottom: 230 });
    const corrected = buildingShadowTransform(sun, sprite, { width: 256, height: 256,
      bottom: buildingShadowBottom("breadOven", 230, 256, sun) });
    expect(corrected.e).toBeLessThan(old.e);
    expect(corrected.f).toBeLessThan(old.f);
    expect(corrected.a).toBe(old.a); expect(corrected.d).toBe(old.d);
  });
  it.each(Object.entries(BUILDING_SHADOW_CONTACT_ROWS))("calibrates %s for evening without changing other presets", (texture, row) => {
    expect(buildingShadowBottom(texture, 250, 256, daylightShadow(19))).toBeCloseTo(256 * row);
    for (const hour of [9, 14, 22]) expect(buildingShadowBottom(texture, 250, 256, daylightShadow(hour))).toBe(250);
    // Never push contact below the artwork when framing changes.
    expect(buildingShadowBottom(texture, 100, 256, daylightShadow(19))).toBe(100);
  });
  it("preserves uncalibrated textures", () => {
    for (const texture of ["mill", "future-building"]) {
      expect(buildingShadowBottom(texture, 230, 256, daylightShadow(19))).toBe(230);
    }
  });
  it("ignores transparent padding and faint stray pixels when anchoring the base", () => {
    const pixels = new Uint8ClampedArray(4 * 8 * 4);
    pixels[(4 * 4 + 1) * 4 + 3] = 255;
    pixels[(7 * 4 + 1) * 4 + 3] = 8;
    expect(opaqueBottom(pixels, 4, 8)).toBe(5);
  });
  it("keeps the visible base fixed through all presets and changes scale with the sprite", () => {
    const sprite = { x: 100, y: 200, displayWidth: 100, displayHeight: 100, originX: 0.5, originY: 1 };
    const frame = { width: 200, height: 200, bottom: 180 };
    for (const hour of [9, 14, 19, 22]) {
      const m = buildingShadowTransform(daylightShadow(hour), sprite, frame);
      expect(m.a * 100 + m.c * 180 + m.e).toBeCloseTo(100);
      expect(m.b * 100 + m.d * 180 + m.f).toBeCloseTo(190);
      expect(Math.hypot(m.a, m.b)).toBeCloseTo(0.5);
    }
  });
  it("keeps the evening base horizontal and projects a substantial silhouette down-right", () => {
    const sprite = { x: 100, y: 200, displayWidth: 100, displayHeight: 100, originX: 0.5, originY: 1 };
    const frame = { width: 200, height: 200, bottom: 180 };
    const evening = buildingShadowTransform(daylightShadow(19), sprite, frame);
    expect(evening.a).toBe(0.5);
    expect(evening.b).toBe(0);
    expect(evening.d).toBeLessThan(-0.2);
    expect(evening.a * 100 + evening.e).toBeGreaterThan(100);
    expect(evening.f).toBeGreaterThan(230);
  });
  it("preserves the approved morning projection and transitions continuously", () => {
    const sprite = { x: 0, y: 0, displayWidth: 100, displayHeight: 100, originX: 0.5, originY: 1 };
    const frame = { width: 100, height: 100, bottom: 100 };
    const sun = daylightShadow(9), morning = buildingShadowTransform(sun, sprite, frame);
    expect(morning.c).toBeCloseTo(-sun.x * sun.length);
    expect(morning.d).toBeCloseTo(0.14 - sun.y * sun.length * 0.5);
    for (let minute = 840; minute < 1201; minute++) {
      const a = buildingShadowTransform(daylightShadow(minute / 60), sprite, frame);
      const b = buildingShadowTransform(daylightShadow((minute + 1) / 60), sprite, frame);
      expect(Math.abs(a.d - b.d)).toBeLessThan(0.03);
    }
  });
  it("projects the roof in opposite directions in morning/evening and flattens it at night", () => {
    const sprite = { x: 0, y: 0, displayWidth: 100, displayHeight: 100, originX: 0.5, originY: 1 };
    const frame = { width: 100, height: 100, bottom: 100 };
    const project = (hour: number) => buildingShadowTransform(daylightShadow(hour), sprite, frame);
    expect(project(9).e + 50).toBeLessThan(0);
    expect(project(19).e + 50).toBeGreaterThan(0);
    expect(project(22).c).toBeCloseTo(0);
    expect(project(22).d).toBeCloseTo(0.14);
  });
});
