import { describe, expect, it } from "vitest";
import { blendFishPosition, riverFishY } from "../../src/client/game/phaser/riverFishMotion";

describe("river fish wave", () => {
  it("swims above and below the centre in a repeating smooth wave", () => {
    expect(riverFishY(1000, 100, 60, 0)).toBe(1050);
    expect(riverFishY(1000, 100, 60, 1000)).toBe(1065);
    expect(riverFishY(1000, 100, 60, 3000)).toBe(1035);
    expect(riverFishY(1000, 100, 60, 4000)).toBeCloseTo(1050);
  });
  it("keeps the entire sprite inside the river at different tile sizes", () => {
    for (const size of [32, 64, 128]) {
      for (let time = 0; time <= 8000; time += 25) {
        const y = riverFishY(10 * size, size, size * 0.6, time);
        expect(y - size * 0.3).toBeGreaterThanOrEqual(10 * size);
        expect(y + size * 0.3).toBeLessThanOrEqual(11 * size);
      }
    }
  });
});

describe("river fish transitions", () => {
  it("starts at the existing position without teleporting", () => {
    expect(blendFishPosition(50, 900, 0, 1200)).toBe(50);
  });
  it("smoothly approaches in either direction", () => {
    expect(blendFishPosition(50, 900, 600, 1200)).toBe(475);
    expect(blendFishPosition(900, 50, 600, 1200)).toBe(475);
  });
  it("matches the authoritative moving target exactly once ready", () => {
    expect(blendFishPosition(50, 800, 1200, 1200)).toBe(800);
    expect(blendFishPosition(50, 600, 1500, 1200)).toBe(600);
  });
  it("holds at the river edge until the respawn delay ends", () => {
    expect(blendFishPosition(-30, 600, -3000, 4000)).toBe(-30);
    expect(blendFishPosition(-30, 600, 1000, 4000)).toBeGreaterThan(-30);
  });
});
