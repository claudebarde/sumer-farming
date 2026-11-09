import { expect, it } from "vitest";
import { furnitureLayoutError, furnitureObstacles } from "../../src/game-core/home/furniture";
import { furnitureAtPointer, furniturePosition, removeFurniture, replaceFurniture, tabletopLayoutError } from "../../src/game-core/home/furnitureSurfaces";
import { FurnitureLayoutSchema } from "../../src/schemas/homeFurniture";
import type { FurniturePlacement } from "../../src/game-data/homeFurniture";

const table: FurniturePlacement = { key: "wooden-table", x: 850, y: 700 };
const bowl: FurniturePlacement = { key: "clay-bowl", x: 70, y: 35, surface: "table" };
const second: FurniturePlacement = { key: "clay-bowl-2", x: 119, y: 60, surface: "table" };
const layout = [table, bowl, second];
it("accepts two separate bowls on the tabletop and persists their attachment", () => {
  expect(furnitureLayoutError(layout)).toBeNull();
  expect(FurnitureLayoutSchema.parse(layout)).toEqual(layout);
  expect(furnitureObstacles(layout)).toHaveLength(1);
});
it("rejects unsupported, orphaned, overlapping or overhanging tabletop items", () => {
  expect(tabletopLayoutError([bowl])).not.toBeNull();
  expect(FurnitureLayoutSchema.safeParse([{ ...bowl, key: "plain-jar" }]).success).toBe(false);
  expect(tabletopLayoutError([table, bowl, { ...second, x: 71, y: 35 }])).not.toBeNull();
  expect(tabletopLayoutError([table, { ...bowl, x: 68, y: 3 }])).not.toBeNull();
  expect(furnitureLayoutError([table, { key: "clay-bowl", x: 850, y: 700 }])).not.toBeNull();
});
it("moves and mirrors bowls with their table and resolves pointer placement", () => {
  const before = furniturePosition(bowl, layout);
  const moved = replaceFurniture(layout, { ...table, x: 900, y: 720 });
  expect(furniturePosition(bowl, moved)).toEqual({ x: before.x + 50, y: before.y + 20 });
  const mirrored = replaceFurniture(layout, { ...table, orientation: "mirrored" });
  const after = furniturePosition(bowl, mirrored);
  expect(after).toEqual({ x: 2 * table.x - before.x, y: before.y });
  const placed = furnitureAtPointer(bowl.key, after, "original", mirrored);
  expect(placed.surface).toBe("table");
  expect(placed.x).toBeCloseTo(bowl.x);
  expect(placed.y).toBeCloseTo(bowl.y);
  expect(furnitureAtPointer(bowl.key, {x: 700, y: 700}, "original", layout).surface).toBeUndefined();
  expect(layout[0]).toEqual(table);
});
it("returns attached bowls when putting the table away, leaving floor furniture alone", () => {
  const floor: FurniturePlacement = {key: "wooden-stool", x: 600, y: 600};
  expect(removeFurniture([...layout, floor], "wooden-table")).toEqual([floor]);
  expect(removeFurniture(layout, "clay-bowl")).toEqual([table, second]);
});
