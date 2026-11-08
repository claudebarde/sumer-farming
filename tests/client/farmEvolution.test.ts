import { expect, it } from "vitest";
import { farmAppearance, FARM_EVOLUTION_SOURCES } from "../../src/client/game/phaser/farmEvolution";

it.each([[1, "farm-level-1"], [2, "farm-level-1"], [3, "farm-level-3"], [4, "farm-level-4"], [8, "farm-level-4"], [9, "farm-level-9"], [10, "farm-level-9"], [11, "farm-level-9"]])("selects the cosmetic stage for level %s", (level, texture) => {
  expect(farmAppearance(Number(level)).texture).toBe(texture);
  expect(FARM_EVOLUTION_SOURCES).toHaveProperty(String(texture));
});
it("uses distinct historical stages and lowers the label for the open low walls", () => {
  expect(farmAppearance().texture).toBe("farm-level-1");
  expect(new Set(Object.values(FARM_EVOLUTION_SOURCES)).size).toBe(4);
  expect(FARM_EVOLUTION_SOURCES["farm-level-9"]).toContain("farm-isometric-historical.png");
  for (const level of [1, 2]) expect(farmAppearance(level).storageChipY).toBe(-60);
  for (const level of [3, 4, 9, 10, 11]) expect(farmAppearance(level).storageChipY).toBe(-150);
});
