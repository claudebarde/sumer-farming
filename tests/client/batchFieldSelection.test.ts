import { describe, expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { plantableFields, harvestableFields, plantingSelectionLimit, togglePlantingField } from "../../src/game-core/farm/batchPlanting";
import { harvestFieldLimit } from "../../src/game-core/farm/harvestCapacity";

const now = Date.parse("2026-10-01T12:00:00Z");
const snapshot = () => FarmSnapshotSchema.parse({
  created: false, player: { shekelBalance: 0 },
  farm: { id: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: []
});

const irrigatedFarm = (happiness: number, barley: number) => {
  const farm = snapshot();
  farm.farm.household.happiness = happiness;
  farm.inventory = [{ itemKey: "barley", quantity: barley }];
  farm.improvements = [3, 4, 5, 6, 7, 8, 9].map(row => ({
    id: `00000000-0000-4000-8000-00000000000${row}`, type: "irrigation" as const, column: 5, row,
    startedAt: new Date(0).toISOString(), completesAt: new Date(1000).toISOString(), destroyStartedAt: null, destroyCompletesAt: null
  }));
  return farm;
};

describe("shared field selection rules", () => {
  it("allows one field with one seed and prevents selecting another", () => {
    const farm = irrigatedFarm(70, 1);
    const eligible = plantableFields(farm, now), limit = plantingSelectionLimit(farm, now);
    const selected = togglePlantingField([], { column: 4, row: 8 }, eligible, limit);
    expect(limit).toBe(1);
    expect(selected).toEqual([{ column: 4, row: 8 }]);
    expect(togglePlantingField(selected, { column: 4, row: 9 }, eligible, limit)).toEqual(selected);
  });
  it.each([[50, 4], [51, 6], [90, 6], [91, 8]])("caps planting at %i happiness to %i fields", (happiness, limit) => {
    const farm = irrigatedFarm(happiness, 20), eligible = plantableFields(farm, now);
    expect(plantingSelectionLimit(farm, now)).toBe(limit);
    let selected: readonly { column: number; row: number }[] = [];
    for (const row of [6, 7, 8, 9]) for (const column of [4, 6]) selected = togglePlantingField(selected, { column, row }, eligible, limit);
    expect(selected).toHaveLength(limit);
    farm.inventory = [{ itemKey: "barley", quantity: 2 }];
    const reduced = plantingSelectionLimit(farm, now);
    expect(reduced).toBe(2);
    expect(togglePlantingField(selected, { column: 4, row: 6 }, eligible, reduced)).toHaveLength(limit - 1);
  });
  it.each([[50, 4], [74, 6], [95, 8]])("caps harvest selection at %i happiness to %i fields and permits deselection", (happiness, limit) => {
    const farm = snapshot();
    farm.farm.household.happiness = happiness;
    farm.crops = Array.from({ length: 9 }, (_, i) => ({
      id: `00000000-0000-4000-8000-00000000000${i}`, cropKey: "barley" as const, column: i % 8, row: 8 + Math.floor(i / 8),
      sowingStartedAt: new Date(0).toISOString(), plantedAt: new Date(10000).toISOString(),
      growthCompletesAt: new Date(1810000).toISOString(), harvestStartedAt: null, harvestCompletesAt: null
    }));
    const eligible = harvestableFields(farm, now);
    expect(harvestFieldLimit(happiness)).toBe(limit);
    let selected: readonly { column: number; row: number }[] = [];
    for (const cell of eligible) selected = togglePlantingField(selected, cell, eligible, limit);
    expect(selected).toHaveLength(limit);
    selected = togglePlantingField(selected, eligible[0]!, eligible, limit);
    expect(selected).toHaveLength(limit - 1);
    selected = togglePlantingField(selected, eligible[limit]!, eligible, limit);
    expect(selected).toHaveLength(limit);
    expect(selected).toContainEqual({ column: farm.crops[limit]!.column, row: farm.crops[limit]!.row });
    expect(togglePlantingField(selected, selected[0]!, eligible, 4)).toHaveLength(limit - 1);
  });
});
