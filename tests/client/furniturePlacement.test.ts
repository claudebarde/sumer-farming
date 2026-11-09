import { INTERIOR_WALLS } from "../../src/game-core/home/interiorWalls";
import { containsPoint } from "../../src/game-core/home/interiorNavigation";
import { expect, it } from "vitest";
import { furnitureLayoutError } from "../../src/game-core/home/furniture";
import { furnitureVisibleEnough, tableHasWallClearance } from "../../src/game-core/home/furniturePlacement";
it("allows a partly concealed jar on room floor", () => {
  expect(furnitureLayoutError([{ key: "plain-jar", x: 1000, y: 790 }])).toBeNull();
});
it("rejects an item hidden behind the front wall", () => {
  expect(furnitureVisibleEnough({ key: "clay-bowl", x: 1040, y: 800 })).toBe(false);
});

it("keeps the entire table clear of the room wall in both orientations", () => {
  for (const orientation of ["original", "mirrored"] as const) {
    expect(tableHasWallClearance({ key: "wooden-table", x: 1100, y: 700, orientation })).toBe(false);
    expect(furnitureLayoutError([{ key: "wooden-table", x: 1100, y: 700, orientation }])).toBe("Leave space between the table and the wall.");
    expect(tableHasWallClearance({ key: "wooden-table", x: 850, y: 700, orientation })).toBe(true);
  }
});

it("occludes furniture at the inner edge of the front-right stone cap", () => {
  const wall = INTERIOR_WALLS.front[1].map(([x, y]) => ({ x, y }));
  // Previously the mask began below this stone-cap pixel, exposing table legs.
  expect(containsPoint({ x: 1160, y: 690 }, wall)).toBe(true);
  expect(containsPoint({ x: 1160, y: 675 }, wall)).toBe(false);
  expect(containsPoint({ x: 1100, y: 720 }, wall)).toBe(true);
});
