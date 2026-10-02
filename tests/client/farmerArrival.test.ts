import { describe, expect, it } from "vitest";
import { getFarmerArrivalAlignment, getFarmerDestination, getFarmerRoadOffset, getGroundArrivalMessage } from "../../src/client/game/phaser/farmerArrival";
import { gridStore } from "../../src/client/stores/gridStore";
import type { Tile } from "../../src/client/game/phaser/types";

describe("ground arrival at canvas boundaries", () => {
  const tile = (column: number, row: number, type: Tile["type"] = "ground"): Tile => ({
    id: `${column}:${row}`, type,
    position: { column, row, posX: column * 64, posY: row * 64 }
  });

  it.each([[0, 0], [0, 1], [0, 2], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2]])(
    "safely inspects edge tile (%i, %i)", (column, row) => {
      gridStore.getState().replaceGrid(Array.from({ length: 9 }, (_, i) => {
        const entry = tile(i % 3, Math.floor(i / 3));
        return { tile: entry, coordinate: entry.position };
      }));
      expect(getGroundArrivalMessage(Object.values(
        gridStore.getState().findAdjacentTiles({ column, row })
      ))).toBe("There is nothing here.");
    }
  );

  it("finds river water after missing neighbours at the left edge", () => {
    const water = tile(1, 0, "water");
    gridStore.getState().replaceGrid([{ tile: water, coordinate: water.position }]);
    expect(getGroundArrivalMessage(Object.values(
      gridStore.getState().findAdjacentTiles({ column: 0, row: 0 })
    ))).toBe("Build an irrigation canal here.");
  });

  it("handles an empty grid", () => {
    gridStore.getState().replaceGrid([]);
    expect(getGroundArrivalMessage(Object.values(
      gridStore.getState().findAdjacentTiles({ column: 0, row: 0 })
    ))).toBe("There is nothing here.");
  });
});

describe("farmer arrival alignment", () => {
  it.each([32, 64, 128])("places the farmer's feet at the road center for tile size %i", tileSize => {
    const roadTop = 5 * tileSize;
    expect(roadTop + getFarmerRoadOffset(true, tileSize) + tileSize).toBe(roadTop + tileSize / 2);
    expect(getFarmerRoadOffset(false, tileSize)).toBe(0);
  });
  const target = { column: 5, row: 2, posX: 320, posY: 128 };

  it.each(["up", "down", "left", "right"] as const)("walks onto the selected tile when approaching from %s", direction => {
    const alignment = getFarmerArrivalAlignment({ id: "walk", type: "move", target });
    expect(alignment).toBe("tile");
    expect(getFarmerDestination(target, direction, 64, alignment)).toEqual({ x: 320, y: 128 });
  });

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
