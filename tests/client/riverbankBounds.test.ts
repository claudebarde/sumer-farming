import { describe, expect, it, vi } from "vitest";
vi.mock("../../src/client/game/phaser/config", () => ({ TILE_SIZE: 64 }));
import { isGatherableRiverbank } from "../../src/game-core/farm/worldBounds";
import { calculateGameplayTilePosition } from "../../src/client/game/phaser/grid";

describe("riverbank gathering bounds", () => {
  it.each([-4, 11])("allows the actual world edge at column %i", column => {
    expect(isGatherableRiverbank({ column, row: 9 })).toBe(true);
  });
  it.each([-5, 12, 16])("rejects decorative riverbank column %i", column => {
    expect(isGatherableRiverbank({ column, row: 9 })).toBe(false);
  });
  it("rejects the extra right-edge scenery rendered in wide canvases", () => {
    const columns = 26;
    const origin = calculateGameplayTilePosition(columns, 8);
    expect(isGatherableRiverbank({ column: columns - 1 - origin.column, row: 9 })).toBe(false);
  });
  it("rejects river water and tiles away from the bank", () => {
    expect(isGatherableRiverbank({ column: 5, row: 10 })).toBe(false);
    expect(isGatherableRiverbank({ column: 5, row: 8 })).toBe(false);
  });
});
