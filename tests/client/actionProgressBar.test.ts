import { expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { drawActionProgress } from "../../src/client/game/phaser/actionProgressBar";
import { ACTION_PROGRESS, actionProgressFraction } from "../../src/game-data/actionProgress";

it("draws the shared 52×7 action bar with a two-pixel border", () => {
  const graphics = { fillStyle: vi.fn().mockReturnThis(), fillRoundedRect: vi.fn().mockReturnThis(), fillRect: vi.fn().mockReturnThis() };
  drawActionProgress(graphics as unknown as Phaser.GameObjects.Graphics, 100, 20, 0.5);
  expect(graphics.fillRoundedRect).toHaveBeenCalledWith(74, 20, 52, 7, 3);
  expect(graphics.fillRect).toHaveBeenCalledWith(76, 22, 24, 3);
  expect(graphics.fillStyle.mock.calls).toEqual([[ACTION_PROGRESS.track], [ACTION_PROGRESS.fill]]);
});

it.each([[-1, 0], [0.5, 0.5], [2, 1], [NaN, 0]])("clamps progress %s to %s", (input, expected) => {
  expect(actionProgressFraction(input)).toBe(expected);
});
