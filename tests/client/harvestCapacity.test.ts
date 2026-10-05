import { describe, expect, it } from "vitest";
import { harvestFieldLimit, lockedHarvestFieldLimit } from "../../src/game-core/farm/harvestCapacity";
import { BatchPlantingSchema } from "../../src/game-data/batchPlanting";
import { GameCommandSchema } from "../../src/schemas/gameCommands";

describe("happiness-based harvest capacity", () => {
  it.each([[0, 4], [50, 4], [51, 6], [90, 6], [91, 8], [100, 8]])("%i happiness allows %i fields", (happiness, fields) => {
    expect(harvestFieldLimit(happiness)).toBe(fields);
  });
  it("preserves saved capacity and defaults legacy jobs to four", () => {
    const legacy = BatchPlantingSchema.parse({ mode: "harvest", id: "00000000-0000-4000-8000-000000000001", total: 4,
      remaining: [], source: { type: "farm", column: 0, row: 0 }, stopRequested: false, phase: { type: "ready" } });
    expect(lockedHarvestFieldLimit(legacy)).toBe(4);
    expect(lockedHarvestFieldLimit({ ...legacy, harvestFieldLimit: 8 })).toBe(8);
  });
  it("caps requests at eight while leaving tier validation to the server", () => {
    const command = { type: "start_batch_harvesting", expectedFarmVersion: 1,
      targets: Array.from({ length: 8 }, (_, column) => ({ column, row: 8 })) };
    expect(GameCommandSchema.safeParse(command).success).toBe(true);
    expect(GameCommandSchema.safeParse({ ...command, targets: [...command.targets, { column: 0, row: 9 }] }).success).toBe(false);
  });
});
