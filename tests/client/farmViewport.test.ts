import { describe, expect, it } from "vitest";
import { FARM_TOP_SCENERY_ROWS, farmWorldToCanvasY, farmScrollContentHeight, isFarmSceneryRow } from "../../src/client/game/phaser/farmViewport";

describe("farm scenery margin", () => {
  it("ends the scrollable content after three desert rows beyond the river", () => {
    const river = 10, size = 64;
    const riverBottom = farmWorldToCanvasY((river + 1) * size, size);
    expect(farmScrollContentHeight(river, size) - riverBottom).toBe(3 * size);
    expect(farmScrollContentHeight(river, size)).toBe(960);
  });
  it("excludes scenery on either side of the playable map from interaction and navigation", () => {
    expect(isFarmSceneryRow(-1, 10)).toBe(true);
    expect(isFarmSceneryRow(0, 10)).toBe(false);
    expect(isFarmSceneryRow(9, 10)).toBe(false);
    expect(isFarmSceneryRow(10, 10)).toBe(false);
    for (const row of [11, 12, 13, 14]) expect(isFarmSceneryRow(row, 10)).toBe(true);
  });
  it("reveals one scenery row above the original playable row zero", () => {
    expect(FARM_TOP_SCENERY_ROWS).toBe(1);
    expect(farmWorldToCanvasY(-64, 64)).toBe(0);
    expect(farmWorldToCanvasY(0, 64)).toBe(64);
  });
  it("keeps sprites extending above the first road tile visible", () => {
    // A full tile of headroom accommodates both worker sprites without
    // changing their world positions or road-alignment offsets.
    for (const top of [-64, -32, -16, 0]) {
      expect(farmWorldToCanvasY(top, 64)).toBeGreaterThanOrEqual(0);
    }
  });
  it("keeps popup anchors and tile edges aligned for either tile size", () => {
    for (const size of [64, 128]) {
      const top = farmWorldToCanvasY(128, 64);
      const bottom = farmWorldToCanvasY(128 + size, 64);
      expect(bottom - top).toBe(size);
      expect(bottom).toBe(128 + size + 64);
    }
  });
});
