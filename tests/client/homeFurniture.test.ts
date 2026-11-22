import { expect, it } from "vitest";
import { furnitureLayoutError, furnitureObstacles } from "../../src/game-core/home/furniture";
import { INTERIOR_ENTRY, interiorPath, interiorSegmentClear } from "../../src/game-core/home/interiorNavigation";
import { SaveFurnitureSchema } from "../../src/schemas/homeFurniture";
const stool = { key: "wooden-stool", x: 850, y: 700 } as const;
it("accepts free floor placement and routes around furniture", () => {
  expect(furnitureLayoutError([stool])).toBeNull();
  const obstacles = furnitureObstacles([stool]);
  const from = { x: 800, y: 700 }, to = { x: 920, y: 700 };
  expect(interiorSegmentClear(from, to, obstacles)).toBe(false);
  const route = interiorPath(from, to, obstacles);
  expect(route.at(-1)).toEqual(to);
  const points = [from, ...route];
  expect(points.slice(1).every((p,i) => interiorSegmentClear(points[i]!,p,obstacles))).toBe(true);
});
it("rejects duplicates, overlaps, walls, doorways, exit and farmer overlap", () => {
  expect(furnitureLayoutError([stool, stool])).toBeTruthy();
  expect(furnitureLayoutError([stool, { ...stool, key: "plain-jar" }])).toBeTruthy();
  for (const position of [{ x: 50, y: 50 }, { x: 566, y: 510 }, INTERIOR_ENTRY]) {
    expect(furnitureLayoutError([{ ...stool, ...position }])).toBeTruthy();
  }
  expect(furnitureLayoutError([stool], stool)).toBeTruthy();
});
it("permits an empty house and rejects invalid saves", () => {
  expect(furnitureLayoutError([])).toBeNull();
  expect(SaveFurnitureSchema.safeParse({ revision: 0, items: [stool] }).success).toBe(true);
  expect(SaveFurnitureSchema.safeParse({ revision: 0, items: [{ ...stool, x: Infinity }] }).success).toBe(false);
  expect(SaveFurnitureSchema.safeParse({ revision: 0, items: [{ ...stool, key: "paid-throne" }] }).success).toBe(false);
});
it("offers starter furniture, the indoor kitchen and achievement artwork, with two distinct baskets", async () => {
  const { HOME_FURNITURE } = await import("../../src/game-data/homeFurniture");
  expect(HOME_FURNITURE).toHaveLength(14);
  expect(HOME_FURNITURE.filter(item => item.key.startsWith("woven-basket"))).toHaveLength(2);
  expect(SaveFurnitureSchema.safeParse({ revision: 0, items: [{ key: "reed-bed", x: 500, y: 350 }] }).success).toBe(false);
  expect(SaveFurnitureSchema.safeParse({ revision: 0, items: [{ key: "painted-jar", x: 850, y: 700 }] }).success).toBe(false);
  expect(furnitureLayoutError([{ key: "woven-basket", x: 850, y: 700 }, { key: "woven-basket-2", x: 950, y: 700 }])).toBeNull();
});

it("keeps saved furniture when retiring the painted jar", async () => {
  const { HomeAppearanceSchema } = await import("../../src/schemas/homeAppearance");
  const saved = HomeAppearanceSchema.parse({ style: "farm-level-9", decoration: "none", furniture: [stool, { key: "painted-jar", x: 950, y: 700 }] });
  expect(saved.furniture).toEqual([stool]);
  expect(SaveFurnitureSchema.safeParse({ revision: 0, items: [{ key: "clay-bowl", x: 850, y: 700 }, { key: "clay-bowl-2", x: 950, y: 700 }] }).success).toBe(true);
});

it("preserves both mat/table/kitchen orientations and rejects unsupported rotations", () => {
  for (const key of ["reed-mat", "wooden-table", "indoor-kitchen"]) {
    const items = [{ key, x: 850, y: 700, orientation: "mirrored" }];
    expect(SaveFurnitureSchema.parse({ revision: 0, items }).items).toEqual(items);
  }
  expect(SaveFurnitureSchema.safeParse({ revision: 0, items: [{ ...stool, orientation: "mirrored" }] }).success).toBe(false);
  expect(SaveFurnitureSchema.safeParse({ revision: 0, items: [{ ...stool, orientation: "upside-down" }] }).success).toBe(false);
  expect(SaveFurnitureSchema.parse({ revision: 0, items: [stool] }).items).toEqual([stool]);
});
