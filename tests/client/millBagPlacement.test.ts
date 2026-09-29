import { describe, expect, it } from "vitest";
import { findMillBagTile } from "../../src/client/game/phaser/millBagPlacement";

describe("Mill bag tile placement", () => {
  const mill = { column: 3, row: 2 };
  const bounds = { columns: 10, rows: 8 };
  it("prefers a tile directly in front, outside the 2×2 footprint", () => {
    expect(findMillBagTile(mill, bounds, () => true)).toEqual({ column: 3, row: 4 });
  });
  it("skips occupied surrounding tiles", () => {
    expect(findMillBagTile(mill, bounds, p => p.column === 5 && p.row === 3)).toEqual({ column: 5, row: 3 });
  });
  it("uses a free corner when the other neighbouring tiles are blocked", () => {
    expect(findMillBagTile(mill, bounds, p => p.column === 2 && p.row === 1)).toEqual({ column: 2, row: 1 });
  });
  it("finds the nearest free ring when the immediate neighbours are full", () => {
    expect(findMillBagTile(mill, bounds, p => p.row === 5)).toEqual({ column: 3, row: 5 });
  });
  it("never selects an off-canvas or river tile", () => {
    const result = findMillBagTile({ column: 0, row: 6 }, bounds, () => true);
    expect(result).toEqual({ column: 2, row: 6 });
  });
  it("returns null instead of overlapping an occupied tile when no space is free", () => {
    expect(findMillBagTile(mill, bounds, () => false)).toBeNull();
  });
});
