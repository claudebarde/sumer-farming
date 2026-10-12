import { describe, expect, it } from "vitest";
import { BatchPlantingSchema } from "../../src/game-data/batchPlanting";
import { isometricPlantingPose, plantingBlocker, sowingProgress } from "../../src/client/game/phaser/isometricPlanting";
import { FarmSnapshotSchema } from "../../src/schemas/farm";

const date = (time: number) => new Date(time).toISOString();
const batch = BatchPlantingSchema.parse({ id: "00000000-0000-4000-8000-000000000001", total: 2,
  source: { type: "granary", column: 5, row: 3 }, stopRequested: false,
  remaining: [{ column: 4, row: 6 }, { column: 3, row: 6 }], phase: { type: "collecting" },
  collectionPath: [{ column: 6, row: 5 }, { column: 5, row: 5 }],
  travelPaths: [[{ column: 5, row: 5 }, { column: 4, row: 5 }, { column: 4, row: 6 }], [{ column: 4, row: 6 }, { column: 3, row: 6 }]],
  travelMs: [360, 180], travelStartedAt: date(1000), nextStepAt: date(2000) });

describe("isometric planting schedule presentation", () => {
  it("counts only completed fields and sowing time, excluding seed collection and travel", () => {
    expect(sowingProgress(batch, 1500)).toEqual({ completed: 0, totalMs: 20000, percentage: 0 });
    expect(sowingProgress(batch, 7360)).toEqual({ completed: 0, totalMs: 20000, percentage: 25 });
    expect(sowingProgress(batch, 12400)).toEqual({ completed: 1, totalMs: 20000, percentage: 50 });
    expect(sowingProgress(batch, 17540)).toEqual({ completed: 1, totalMs: 20000, percentage: 75 });
    expect(sowingProgress(batch, 22540)).toEqual({ completed: 2, totalMs: 20000, percentage: 100 });
  });
  it("shows 1/4 while sowing the second field, with reload-safe progress", () => {
    const saved = { ...batch, total: 4, phase: { type: "sowing" as const, target: batch.remaining[0]!, completesAt: date(10000) } };
    expect(sowingProgress(saved, 5000)).toEqual({ completed: 1, totalMs: 40000, percentage: 37 });
    expect(sowingProgress({ ...saved, stopRequested: true }, 10000)).toEqual({ completed: 2, totalMs: 40000, percentage: 50 });
  });
  it("turns toward the seed building just before collection without shifting its deadline", () => {
    expect(isometricPlantingPose(batch, 1500)?.facingLeft).toBe(true);
    expect(isometricPlantingPose(batch, 1900)).toMatchObject({ facingLeft: false, seeds: 0 });
    expect(isometricPlantingPose(batch, 2000)?.seeds).toBe(2);
  });
  it("walks to storage before carrying the reserved seeds", () => {
    const pose = isometricPlantingPose(batch, 1500)!;
    expect(pose.type).toBe("walking");
    expect(pose.position).toEqual({ column: 5.5, row: 5 });
    expect(pose.seeds).toBe(0);
    expect(isometricPlantingPose(batch, 2000)?.seeds).toBe(2);
  });
  it("follows saved route corners and starts sowing only upon arrival", () => {
    expect(isometricPlantingPose(batch, 2180)?.position).toEqual({ column: 4, row: 5 });
    expect(isometricPlantingPose(batch, 2359)?.type).toBe("walking");
    expect(isometricPlantingPose(batch, 2360)).toMatchObject({ type: "sowing", position: batch.remaining[0], seeds: 1, elapsed: 0 });
    expect(isometricPlantingPose(batch, 12360)).toMatchObject({ type: "walking", position: batch.remaining[0], seeds: 1 });
    expect(isometricPlantingPose(batch, 12540)).toMatchObject({ type: "sowing", position: batch.remaining[1], seeds: 0 });
  });
  it("catches up across a hidden tab without mutating the saved job", () => {
    const before = JSON.stringify(batch);
    expect(isometricPlantingPose(batch, 100_000)).toMatchObject({ type: "done", position: batch.remaining[1], seeds: 0 });
    expect(JSON.stringify(batch)).toBe(before);
  });
  it("renders the same pose from old and refreshed snapshots", () => {
    const refreshed = { ...batch, remaining: batch.remaining.slice(1), travelPaths: batch.travelPaths?.slice(1), travelMs: batch.travelMs?.slice(1),
      phase: { type: "sowing" as const, target: batch.remaining[0]!, completesAt: date(12360) } };
    expect(isometricPlantingPose(refreshed, 5000)).toEqual(isometricPlantingPose(batch, 5000));
    expect(isometricPlantingPose(refreshed, 12400)).toEqual(isometricPlantingPose(batch, 12400));
  });
  it("finishes only the current field when stopping", () => {
    const stopped = { ...batch, stopRequested: true, remaining: batch.remaining.slice(1),
      phase: { type: "sowing" as const, target: batch.remaining[0]!, completesAt: date(12360) } };
    expect(isometricPlantingPose(stopped, 6000)?.type).toBe("sowing");
    expect(isometricPlantingPose(stopped, 20000)).toMatchObject({ type: "done", position: batch.remaining[0] });
  });
  it("skips collection when carried seeds already cover the selection", () => {
    const carried = { ...batch, collectionPath: undefined, phase: { type: "ready" as const }, nextStepAt: date(1360) };
    expect(isometricPlantingPose(carried, 1000)).toMatchObject({ type: "walking", seeds: 2, position: { column: 5, row: 5 } });
  });
  it("does not present a harvest job as sowing", () => {
    expect(isometricPlantingPose({ ...batch, mode: "harvest" }, 5000)).toBeNull();
  });
  it("blocks starting while busy or carrying another resource", () => {
    const snapshot = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
      farm: { id: batch.id, playerId: batch.id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
      inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
    expect(plantingBlocker(snapshot, 0)).toBeNull();
    snapshot.farm.carriedItem = { itemKey: "clay", quantity: 1, expiresAt: null };
    expect(plantingBlocker(snapshot, 0)).toBe("Empty your hands first");
    snapshot.farm.carriedItem = null;
    snapshot.farm.production.planting = batch;
    expect(plantingBlocker(snapshot, 0)).toBe("Farmer busy");
  });
});
