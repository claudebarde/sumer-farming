import { describe, expect, it } from "vitest";
import { BatchPlantingSchema } from "../../src/game-data/batchPlanting";
import { batchTravelPresentation } from "../../src/client/game/phaser/batchTravelPresentation";

const path = [{ column: 4, row: 8 }, { column: 4, row: 7 }, { column: 3, row: 7 }];
const batch = BatchPlantingSchema.parse({ id: "00000000-0000-4000-8000-000000000001", total: 1,
  remaining: [{ column: 3, row: 8 }], source: { type: "farm", column: 0, row: 0 }, stopRequested: false,
  phase: { type: "collecting" }, collectionPath: path, travelPaths: [[path[2], { column: 3, row: 8 }]],
  travelStartedAt: new Date(1000).toISOString(), nextStepAt: new Date(3000).toISOString() });

describe("saved batch movement", () => {
  it("walks continuously from the current position to seed storage around corners", () => {
    expect(batchTravelPresentation(batch, 1000)).toEqual(path[0]);
    expect(batchTravelPresentation(batch, 1500)).toEqual({ column: 4, row: 7.5 });
    expect(batchTravelPresentation(batch, 2500)).toEqual({ column: 3.5, row: 7 });
    expect(batchTravelPresentation(batch, 4000)).toEqual(path[2]);
  });
  it("starts the field leg at exactly the seed pickup position", () => {
    const ready = { ...batch, phase: { type: "ready" as const }, travelStartedAt: new Date(3000).toISOString(), nextStepAt: new Date(4000).toISOString() };
    expect(batchTravelPresentation(ready, 3000)).toEqual(batchTravelPresentation(batch, 3000));
    expect(batchTravelPresentation(ready, 3500)).toEqual({ column: 3, row: 7.5 });
    expect(batchTravelPresentation(ready, 4000)).toEqual(ready.remaining[0]);
  });
  it("samples the same position after refresh instead of restarting the walk", () => {
    expect(batchTravelPresentation(BatchPlantingSchema.parse(batch), 2500)).toEqual(batchTravelPresentation(batch, 2500));
    expect(batchTravelPresentation({ ...batch, stopRequested: true }, 2500)).toEqual(batchTravelPresentation(batch, 2500));
  });
  it("leaves work phases and legacy queues to their existing presentation", () => {
    expect(batchTravelPresentation({ ...batch, phase: { type: "sowing", target: path[2]!, completesAt: new Date(13000).toISOString() } }, 3500)).toBeNull();
    expect(batchTravelPresentation({ ...batch, collectionPath: undefined }, 1500)).toBeNull();
  });
});
