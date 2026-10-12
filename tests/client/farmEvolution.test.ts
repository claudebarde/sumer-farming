import { expect, it } from "vitest";
import { farmAppearance, FARM_EVOLUTION_SOURCES } from "../../src/client/game/phaser/farmEvolution";

it.each([[1, "farm-level-1"], [2, "farm-level-1"], [3, "farm-level-3"], [4, "farm-level-4"], [8, "farm-level-4"], [9, "farm-level-9"], [10, "farm-level-9"], [11, "farm-level-9"]])("selects the cosmetic stage for level %s", (level, texture) => {
  expect(farmAppearance(Number(level)).texture).toBe(texture);
  expect(FARM_EVOLUTION_SOURCES).toHaveProperty(String(texture));
});
it("defaults older saves to the first stage and keeps stock labels lower on shorter stages", () => {
  expect(farmAppearance().texture).toBe("farm-level-1");
  expect(farmAppearance(1).storageChipY).toBeGreaterThan(farmAppearance(3).storageChipY);
  expect(farmAppearance(3).storageChipY).toBeGreaterThan(farmAppearance(9).storageChipY);
});
