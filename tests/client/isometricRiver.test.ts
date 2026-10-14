import { describe, expect, it } from "vitest";
import { INITIAL_FARM_CONFIG as config } from "../../src/game-data/initialFarm";
import { ISOMETRIC_RIVER_ROWS, isIsometricRiverRow } from "../../src/client/game/phaser/isometricRiver";

describe("isometric river width preview", () => {
  it("adds exactly one southern row without moving the north bank", () => {
    expect(ISOMETRIC_RIVER_ROWS).toEqual([config.riverRow, config.riverRow + 1]);
    expect(isIsometricRiverRow(config.riverRow - 1)).toBe(false);
    expect(isIsometricRiverRow(config.riverRow)).toBe(true);
    expect(isIsometricRiverRow(config.riverRow + 1)).toBe(true);
    expect(isIsometricRiverRow(config.riverRow + 2)).toBe(false);
    expect(isIsometricRiverRow(config.plotBounds.maximumRow)).toBe(false);
  });
});
