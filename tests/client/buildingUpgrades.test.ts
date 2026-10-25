import { describe, expect, it } from "vitest";
import { activeBuildingUpgrade, buildingLevel, buildingProductionMultiplier, BUILDING_UPGRADES, type BuildingUpgrades } from "../../src/game-data/buildingUpgrades";
import { millRecipe } from "../../src/game-data/milling";
import { BREAD_RECIPE } from "../../src/game-data/production";

const id = "00000000-0000-4000-8000-000000000003";
const start = Date.parse("2026-10-04T12:00:00Z");
const upgrades: BuildingUpgrades = { [id]: [{ level: 2, startedAt: new Date(start).toISOString(), completesAt: new Date(start + 300000).toISOString(), idempotencyKey: "00000000-0000-4000-8000-000000000004" }] };

describe("shared building upgrade rules", () => {
  it.each([
    ["mill", 2, 8], ["mill", 3, 10], ["breadOven", 2, 9], ["breadOven", 3, 11], ["brewery", 2, 9], ["brewery", 3, 11]
  ] as const)("keeps the %s level %s unlock at estate level %s", (type, target, required) => {
    expect(BUILDING_UPGRADES[type]?.[target]).toMatchObject({ estateLevel: required, cost: target === 2 ? 100 : 200 });
  });
  it("shortens baking after the upgrade deadline", () => {
    const before = buildingLevel(upgrades, id, start + 299999);
    const after = buildingLevel(upgrades, id, start + 300000);
    expect(BREAD_RECIPE.durationMs * buildingProductionMultiplier("breadOven", before)).toBe(300000);
    expect(BREAD_RECIPE.durationMs * buildingProductionMultiplier("breadOven", after)).toBe(255000);
  });
  it("defaults legacy saves to level 1 and completes exactly at the deadline", () => {
    expect(buildingLevel(undefined, id, start)).toBe(1);
    expect(buildingLevel(upgrades, id, start + 299999)).toBe(1);
    expect(activeBuildingUpgrade(upgrades, id, start + 299999)).toBeDefined();
    expect(buildingLevel(upgrades, id, start + 300000)).toBe(2);
    expect(activeBuildingUpgrade(upgrades, id, start + 300000)).toBeUndefined();
    expect(buildingLevel(upgrades, "another-building", start + 300000)).toBe(1);
  });
  it.each(["flour", "brewersGroats"] as const)("reduces %s recipe time without changing inputs or output", recipe => {
    for (const worker of ["farmer", "donkey"] as const) {
      const base = millRecipe(recipe, worker);
      for (const level of [2, 3]) {
        const upgraded = millRecipe(recipe, worker, level);
        expect(upgraded.barley).toBe(base.barley);
        expect(upgraded.output).toBe(base.output);
        expect(upgraded.durationMs).toBe(base.durationMs * (level === 2 ? 0.85 : 0.7));
      }
    }
    expect(BUILDING_UPGRADES.mill?.[2]?.cost).toBe(100);
    expect(BUILDING_UPGRADES.mill?.[3]?.cost).toBe(200);
    expect(BUILDING_UPGRADES.warehouse).toBeUndefined();
  });
});
