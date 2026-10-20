import { describe, expect, it } from "vitest";
import type { MillingJob } from "../../src/game-data/milling";
import { donkeyEscortPath, donkeyMillingPose } from "../../src/client/game/phaser/donkeyMilling";

const job: MillingJob = {
  worker: "donkey", buildingId: "mill", recipe: "flour", barley: 6, output: 3,
  startedAt: new Date(6000).toISOString(), completesAt: new Date(906000).toISOString(),
  preparation: { departedAt: 0, stepDurationMs: 1000, supplyIndex: 4, donkeyPickupIndex: 1, donkeyDropIndex: 3,
    path: [{ column: -2, row: 5 }, { column: -3, row: 5 }, { column: -3, row: 4 }, { column: -2, row: 4 },
      { column: -2, row: 5 }, { column: -2, row: 4 }, { column: -2, row: 3 }] }
};

describe("saved donkey escort presentation", () => {
  it("waits at pickup, follows behind through corners, then enters the mill", () => {
    expect(donkeyMillingPose(job, 500)).toMatchObject({ phase: "waiting", walking: false, position: { column: -3, row: 5 } });
    expect(donkeyMillingPose(job, 2150)).toMatchObject({ phase: "following", walking: true, position: { column: -3, row: 4.5 } });
    expect(donkeyMillingPose(job, 3150)).toMatchObject({ position: { column: -2.5, row: 4 } });
    expect(donkeyMillingPose(job, 3700)).toBeNull();
    expect(donkeyMillingPose(job, 10000)).toBeNull();
  });
  it("reloads at the elapsed pose rather than repeating pickup", () => {
    const restored = JSON.parse(JSON.stringify(job)) as MillingJob;
    expect(donkeyMillingPose(restored, 3150)).toEqual(donkeyMillingPose(job, 3150));
    expect(donkeyEscortPath(restored)).toEqual(job.preparation!.path.slice(1, 4));
  });
  it("returns along the escort path, and rests immediately after long absence", () => {
    expect(donkeyMillingPose(job, 906450)).toMatchObject({ phase: "returning", position: { column: -2.5, row: 4 } });
    expect(donkeyMillingPose(job, 908000)).toMatchObject({ phase: "resting", walking: false, position: { column: -3, row: 5 } });
    expect(donkeyMillingPose(job, 1000000)?.phase).toBe("resting");
  });
  it("handles old jobs without a journey and zero-length escort", () => {
    expect(donkeyMillingPose({ ...job, preparation: undefined }, 0)).toBeNull();
    expect(donkeyMillingPose({ ...job, worker: "farmer" }, 0)).toBeNull();
    const same = { ...job, preparation: { ...job.preparation!, donkeyDropIndex: 1 } };
    expect(donkeyMillingPose(same, 500)?.phase).toBe("waiting");
    expect(donkeyMillingPose(same, 1000)).toBeNull();
  });
});
