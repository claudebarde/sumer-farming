import { describe, expect, it } from "vitest";
import { isoPoint, isoCell, isoPath, isoWalkable, ISO_SCENERY, isoField, isoBuilding, isoBarleyStage } from "../../src/client/game/phaser/isometricTest";

describe("isometric sandbox", () => {
  it("shows two sown, three growing and three ripe fields, and no crops elsewhere", () => {
    const stages = [];
    for (let row = 0; row < 10; row++) for (let column = 0; column < 10; column++) {
      const stage = isoBarleyStage({ column, row });
      if (stage) stages.push(stage);
    }
    expect(stages.filter(s => s === "sown")).toHaveLength(2);
    expect(stages.filter(s => s === "growing")).toHaveLength(3);
    expect(stages.filter(s => s === "ripe")).toHaveLength(3);
    expect(stages).toHaveLength(8);
  });
  it("keeps all scenery off roads, fields, buildings and water", () => {
    expect(new Set(ISO_SCENERY.map(c => `${c.column}:${c.row}`)).size).toBe(ISO_SCENERY.length);
    for (const cell of ISO_SCENERY) {
      expect(cell.row).toBeLessThan(8);
      expect(cell.row).not.toBe(4);
      expect(cell.column).not.toBe(3);
      expect(isoField(cell) || isoBuilding(cell)).toBe(false);
      expect(isoWalkable(cell)).toBe(false);
    }
    expect(new Set(ISO_SCENERY.map(c => c.sprite)).size).toBe(4);
  });
  it("round-trips tile centres through the projection", () => {
    for (let row = 0; row < 10; row++) for (let column = 0; column < 10; column++) {
      const point = isoPoint({ column, row });
      expect(isoCell(point.x, point.y)).toEqual({ column, row });
    }
  });
  it("walks around the building with cardinal steps", () => {
    const start = { column: 3, row: 2 }, target = { column: 6, row: 2 };
    const path = isoPath(start, target);
    expect(path.at(-1)).toEqual(target);
    let previous = start;
    for (const cell of path) {
      expect(isoWalkable(cell)).toBe(true);
      expect(Math.abs(cell.column - previous.column) + Math.abs(cell.row - previous.row)).toBe(1);
      previous = cell;
    }
  });
  it("rejects river, canal, building, and out-of-bounds targets", () => {
    for (const target of [{ column: 2, row: 8 }, { column: 9, row: 6 }, { column: 4, row: 2 }, { column: -1, row: 0 }])
      expect(isoPath({ column: 3, row: 4 }, target)).toEqual([]);
  });
});
