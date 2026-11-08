import { expect, it } from "vitest";
import { furnitureLayoutError } from "../../src/game-core/home/furniture";
import { furnitureVisibleEnough } from "../../src/game-core/home/furniturePlacement";
it("allows a partly concealed jar on room floor", () => {
  expect(furnitureLayoutError([{ key: "plain-jar", x: 1000, y: 790 }])).toBeNull();
});
it("rejects an item hidden behind the front wall", () => {
  expect(furnitureVisibleEnough({ key: "clay-bowl", x: 1040, y: 800 })).toBe(false);
});
