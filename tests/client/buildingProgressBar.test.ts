import { expect, it } from "vitest";
import { buildingProgressPosition } from "../../src/client/game/phaser/buildingProgressBar";

const view = { x: 0, y: 0, width: 800, height: 600 };
it("centres the bar above the building with an eight-pixel world gap", () => {
  expect(buildingProgressPosition({ x: 200, y: 100, width: 150, height: 150 }, view, 1))
    .toEqual({ x: 275, y: 85, visible: true });
});
it("keeps bars inside each viewport edge after zooming and panning", () => {
  const viewport = { x: 100, y: 200, width: 400, height: 300 };
  const left = buildingProgressPosition({ x: 60, y: 190, width: 100, height: 100 }, viewport, 2);
  expect(left).toEqual({ x: 130, y: 204, visible: true });
  const right = buildingProgressPosition({ x: 490, y: 490, width: 100, height: 100 }, viewport, 2);
  expect(right.x).toBe(470);
  expect(right.y + 7).toBeLessThanOrEqual(496);
});
it("does not pin bars belonging to fully offscreen buildings to the screen edge", () => {
  for (const [x, y] of [[-200, 100], [900, 100], [100, -200], [100, 700]]) {
    expect(buildingProgressPosition({ x: x!, y: y!, width: 100, height: 100 }, view, 1).visible).toBe(false);
  }
});
