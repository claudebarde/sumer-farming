import { describe, expect, it } from "vitest";
import { clipShadow, daylightShadow, shadowEllipse, shadowHour } from "../../src/client/game/phaser/daylightShadows";
import { isoPoint } from "../../src/client/game/phaser/isometricProjection";

describe("cosmetic daylight shadows", () => {
  it("clips shadows to map edges instead of spilling onto the page", () => {
    const bounds = { minimumColumn: 0, maximumColumn: 2, minimumRow: 0, maximumRow: 2 };
    const points = [{ column: 1, row: 1 }, { column: 4, row: 1 }, { column: 4, row: 4 }, { column: 1, row: 4 }].map(isoPoint);
    const clipped = clipShadow(points, bounds);
    expect(clipped).toHaveLength(4);
    for (const p of clipped) {
      expect(p.x / 96 + p.y / 48).toBeLessThanOrEqual(2.5);
      expect(p.y / 48 - p.x / 96).toBeLessThanOrEqual(2.5);
    }
    expect(clipShadow(points, { minimumColumn: -5, maximumColumn: -3, minimumRow: -5, maximumRow: -3 })).toEqual([]);
  });
  it("uses local wall time or deterministic preview hours", () => {
    const now = new Date(2026, 9, 15, 10, 30, 0);
    expect(shadowHour("local", now)).toBe(10.5);
    expect(shadowHour("morning", now)).toBe(9);
    expect(shadowHour("midday", now)).toBe(14);
    expect(shadowHour("evening", now)).toBe(19);
    expect(shadowHour("night", now)).toBe(22);
    expect(shadowHour("local", new Date(2026, 9, 15, 18, 0))).toBe(18);
  });
  it("projects west, south and east shadows opposite the specified sun path", () => {
    const morning = daylightShadow(8.5), midday = daylightShadow(14), evening = daylightShadow(19.5);
    expect(morning.x).toBeLessThan(0); expect(morning.y).toBeLessThan(0);
    expect(midday.x).toBeLessThan(0); expect(midday.y).toBeGreaterThan(0);
    expect(evening.x).toBeGreaterThan(0); expect(evening.y).toBeGreaterThan(0);
    expect(midday.length).toBeLessThan(morning.length);
    expect(midday.length).toBeLessThan(evening.length);
  });
  it("fades smoothly at dawn/dusk and has compact, faint night contact ovals", () => {
    expect(daylightShadow(8.25).alpha).toBeCloseTo(0.15);
    expect(daylightShadow(19.75).alpha).toBeCloseTo(0.15);
    expect(daylightShadow(14).alpha).toBeCloseTo(0.2);
    for (const hour of [0, 7, 8, 20, 23.99]) {
      const oval = shadowEllipse(daylightShadow(hour), 24, 48);
      expect(oval.x).toBeCloseTo(0); expect(oval.y).toBeCloseTo(0);
      expect(oval.width).toBeCloseTo(24); expect(oval.height).toBeCloseTo(12);
      expect(oval.alpha).toBe(0.1);
    }
  });
  it("keeps all dimensions finite, bounded and continuous throughout the day", () => {
    for (let minute = 0; minute < 1440; minute++) {
      const oval = shadowEllipse(daylightShadow(minute / 60), 130, 140);
      expect(oval.width).toBeGreaterThan(0); expect(oval.width).toBeLessThanOrEqual(270);
      expect(oval.height).toBeGreaterThan(0);
      expect(Number.isFinite(oval.rotation)).toBe(true);
      const next = shadowEllipse(daylightShadow((minute + 1) / 60), 130, 140);
      expect(Math.abs(oval.x - next.x)).toBeLessThan(3);
      expect(Math.abs(oval.y - next.y)).toBeLessThan(3);
    }
  });
});
