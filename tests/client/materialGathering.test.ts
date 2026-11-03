import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { gatheringRoom, planMaterialGathering } from "../../src/game-core/farm/materialGathering";
import { materialGatheringPose } from "../../src/client/game/phaser/materialGatheringPresentation";
import { isoPoint } from "../../src/client/game/phaser/isometricProjection";
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
it.each(["clay", "reed"] as const)("keeps the %s gathering-to-carrying transition continuous", itemKey => {
  const s = snapshot();
  const job = planMaterialGathering(s, itemKey, 3, { column: -1, row: 9 }, 1000)!;
  expect(job).not.toBeNull();
  const before = materialGatheringPose(job, job.workEndsAt - 1);
  const after = materialGatheringPose(job, job.workEndsAt);
  expect(before.phase).toBe("gathering"); expect(after.phase).toBe("delivering");
  expect(after.quantity).toBe(3);
  expect(isoPoint(after.visualPosition)).toEqual(isoPoint(before.visualPosition));
  expect(materialGatheringPose(job, job.startedAt + 1).walking).toBe(true);
  expect(materialGatheringPose(job, job.completesAt).quantity).toBe(0);
  s.farm.production.materialGathering = job;
  expect(gatheringRoom(s, itemKey, 1000)).toBe(3);
});
it("uses farm storage before warehouses unlock and refuses over-capacity jobs", () => {
  const s = snapshot();
  const job = planMaterialGathering(s, "clay", 6, { column: -1, row: 9 }, 1000)!;
  expect(job.deliveries.map(d => [d.storageId, d.quantity])).toEqual([["farm", 6]]);
  expect(planMaterialGathering(s, "clay", 7, { column: -1, row: 9 }, 1000)).toBeNull();
});
