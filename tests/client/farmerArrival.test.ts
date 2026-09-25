import { describe, expect, it } from "vitest";
import { getFarmerArrivalAlignment, getFarmerDestination } from "../../src/client/game/phaser/farmerArrival";

describe("farmer arrival alignment", () => {
  const target = { column: 5, row: 2, posX: 320, posY: 128 };

  it.each(["collect_water", "pour_water", "deliver"] as const)("aligns %s actions with the bank or building edge", action => {
    expect(getFarmerArrivalAlignment({ id: "supplies", type: "brewery_supply", action, target })).toBe("tile");
  });

  it("uses tile alignment for granary storage and retains overlap for harvesting", () => {
    expect(getFarmerArrivalAlignment({ id: "deposit", type: "deposit", storage: "granary", target })).toBe("tile");
    expect(getFarmerArrivalAlignment({ id: "withdraw", type: "withdraw", storage: "granary", item: "barley", target })).toBe("tile");
    expect(getFarmerArrivalAlignment({ id: "harvest", type: "harvest", target })).toBe("overlap");
  });

  it.each([32, 64, 128])("touches the granary footprint from each side at tile size %i", tileSize => {
    const building = { column: 5, row: 2, columns: 2, rows: 2 };
    const below = getFarmerDestination({ column: 5, row: 4 }, "up", tileSize, "tile");
    const above = getFarmerDestination({ column: 5, row: 1 }, "down", tileSize, "tile");
    const left = getFarmerDestination({ column: 4, row: 2 }, "right", tileSize, "tile");
    const right = getFarmerDestination({ column: 7, row: 2 }, "left", tileSize, "tile");
    expect(below.y).toBe((building.row + building.rows) * tileSize);
    expect(above.y + tileSize).toBe(building.row * tileSize);
    expect(left.x + tileSize).toBe(building.column * tileSize);
    expect(right.x).toBe((building.column + building.columns) * tileSize);
  });

  it("resolves a full tile destination even when no new grid step is needed", () => {
    expect(getFarmerDestination(target, null, 64, "tile")).toEqual({ x: 320, y: 128 });
  });

  it("keeps the original half-tile stops for field actions", () => {
    expect(getFarmerDestination(target, "up", 64, "overlap")).toEqual({ x: 320, y: 160 });
    expect(getFarmerDestination(target, "down", 64, "overlap")).toEqual({ x: 320, y: 96 });
    expect(getFarmerDestination(target, "left", 64, "overlap")).toEqual({ x: 352, y: 128 });
    expect(getFarmerDestination(target, "right", 64, "overlap")).toEqual({ x: 288, y: 128 });
  });
});
