import { expect, it } from "vitest";
import { neighbourhoodRoads } from "../../src/game-data/neighbourhoodGeometry";
import { ZIGGURAT_CELEBRATION_MS, zigguratCelebrationRoadLoop, zigguratCelebrationPose } from "../../src/game-data/zigguratCelebration";
it("follows a closed road loop around the ziggurat without crossing its footprint", () => {
  const loop = zigguratCelebrationRoadLoop;
  for (const [i, cell] of loop.entries()) {
    expect(neighbourhoodRoads).toContainEqual(cell);
    const next = loop[(i + 1) % loop.length]!;
    expect(Math.abs(next.column - cell.column) + Math.abs(next.row - cell.row)).toBe(1);
    expect(cell.column >= -5 && cell.column <= -2 && cell.row >= -2 && cell.row <= 1).toBe(false);
  }
});
it("keeps five musicians spaced, fades in/out and lasts 25 seconds", () => {
  expect(ZIGGURAT_CELEBRATION_MS).toBe(25000);
  expect(zigguratCelebrationPose(0, 0).alpha).toBe(0);
  expect(zigguratCelebrationPose(1000, 0).alpha).toBe(1);
  expect(zigguratCelebrationPose(24500, 0).alpha).toBe(.5);
  expect(zigguratCelebrationPose(25000, 0).alpha).toBe(0);
  for (let elapsed = 0; elapsed < 25000; elapsed += 100) {
    const positions = Array.from({ length: 5 }, (_, i) => JSON.stringify(zigguratCelebrationPose(elapsed, i).position));
    expect(new Set(positions).size).toBe(5);
  }
});
