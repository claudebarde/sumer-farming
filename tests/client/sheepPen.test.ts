import { expect, it } from "vitest";
import { sheepPenAppearance } from "../../src/client/game/phaser/sheepPen";
import { commandUnlockLevel } from "../../src/game-core/farm/commandUnlock";
it.each([
  [{ column: 2, row: 3 }, "sheepPenRear", false],
  [{ column: 3, row: 2 }, "sheepPenRear", true],
  [{ column: 5, row: 3 }, "sheepPen", true],
  [{ column: 3, row: 5 }, "sheepPen", false],
] as const)("faces the gate toward %s", (road, texture, flipX) => {
  expect(sheepPenAppearance({ column: 3, row: 3 }, road)).toEqual({ texture, flipX });
});
it("unlocks pen construction at level 12", () => {
  expect(commandUnlockLevel({ type: "build_sheep_pen", target: { column: 5, row: 3 }, expectedFarmVersion: 1 })).toBe(12);
});
