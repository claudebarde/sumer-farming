import { describe, expect, it } from "vitest";
import { findCentralFarmerTile } from "../../src/client/game/phaser/farmerSpawn";

describe("farmer starting tile", () => {
  it("starts in the centre of an empty 8 by 8 plot", () => {
    expect(findCentralFarmerTile({ column: 0, row: 0 }, 8, () => true)).toEqual({ column: 4, row: 4 });
  });
  it("uses an adjacent tile when the centre is occupied", () => {
    const tile = findCentralFarmerTile({ column: 0, row: 0 }, 8, p => p.column !== 4 || p.row !== 4)!;
    expect(Math.abs(tile.column - 4) + Math.abs(tile.row - 4)).toBe(1);
  });
  it("searches beyond a building footprint and its occupied neighbours", () => {
    const tile = findCentralFarmerTile({ column: 0, row: 0 }, 8,
      p => Math.abs(p.column - 4) + Math.abs(p.row - 4) > 2)!;
    expect(Math.abs(tile.column - 4) + Math.abs(tile.row - 4)).toBe(3);
  });
  it("accounts for the plot's canvas offset", () => {
    expect(findCentralFarmerTile({ column: 3, row: 2 }, 8, () => true)).toEqual({ column: 7, row: 6 });
  });
  it("returns null for a full plot so the caller can search outside it", () => {
    expect(findCentralFarmerTile({ column: 0, row: 0 }, 8, () => false)).toBeNull();
  });
});
