import { describe, expect, it } from "vitest";
import { improvementIsPresent, improvementWorkActive } from "../../src/game-data/farmImprovements";
import { plantableFields } from "../../src/game-core/farm/batchPlanting";
import { FarmSnapshotSchema } from "../../src/schemas/farm";

const now = 10000;
const canal = (column: number, row: number, destroyed = false) => ({
  id: `00000000-0000-4000-8000-${String(column * 10 + row).padStart(12, "0")}`,
  type: "irrigation", column, row, startedAt: new Date(0).toISOString(), completesAt: new Date(1000).toISOString(),
  destroyStartedAt: destroyed ? new Date(5000).toISOString() : null,
  destroyCompletesAt: destroyed ? new Date(now).toISOString() : null
});

describe("completed irrigation removal", () => {
  it("releases the farmer at the deadline even with a stale destruction record", () => {
    const removed = canal(3, 8, true);
    expect(improvementWorkActive(removed, now - 1)).toBe(true);
    expect(improvementWorkActive(removed, now)).toBe(false);
    expect(improvementWorkActive(removed, now + 100000)).toBe(false);
    expect(improvementIsPresent(removed, now)).toBe(false);
    expect(improvementWorkActive(canal(2, 9), now)).toBe(false);
    expect(improvementWorkActive({ ...canal(2, 9), completesAt: new Date(now + 1).toISOString() }, now)).toBe(true);
  });
  it("keeps neighbouring fields plantable and frees the removed branch tile", () => {
    const snapshot = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
      farm: { id: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", version: 1,
        household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
      inventory: [], objects: [], groundItems: [], crops: [], buildings: [],
      improvements: [canal(2, 9), canal(2, 8), canal(2, 7), canal(3, 8, true)] });
    const fields = plantableFields(snapshot, now);
    expect(fields).toContainEqual({ column: 3, row: 8 });
    expect(fields).toContainEqual({ column: 1, row: 8 });
    expect(fields).toContainEqual({ column: 3, row: 7 });
    // A removed canal no longer supplies water to its far neighbour.
    expect(fields).not.toContainEqual({ column: 4, row: 8 });
  });
});
