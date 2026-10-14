import { expect, it } from "vitest";
import { groundItemDepth } from "../../src/client/game/phaser/isometricFarm";

it.each(["reed", "clay"])("layers dropped %s above same-tile idle, walking and transfer poses", itemKey => {
  const y = 120;
  expect(groundItemDepth(y, itemKey)).toBeGreaterThan(y + 1);
  expect(groundItemDepth(y, itemKey)).toBeGreaterThan(y + 2);
  // An actor on the next nearer tile still appears in front.
  expect(groundItemDepth(y, itemKey)).toBeLessThan(y + 24 + 1);
});

it("preserves barley and other ground-item depth", () => {
  expect(groundItemDepth(120, "barley")).toBe(121);
  expect(groundItemDepth(120, "fish")).toBe(121);
});
