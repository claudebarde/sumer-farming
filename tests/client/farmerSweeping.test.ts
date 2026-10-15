import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { planSweeping, sweepingPose, sweepTexture, SWEEP_IDLE_DELAY, SWEEP_DWELL_MS } from "../../src/client/game/phaser/farmerSweeping";
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
it("uses a 10 second inactivity delay without a distance restriction", () => {
  expect(SWEEP_IDLE_DELAY).toBe(10000);
  for (const from of [{ column: 5, row: 9 }, { column: -4, row: 0 }, { column: 7, row: 6 }]) {
    const plan = planSweeping(snapshot(), from, 1000)!;
    expect(plan).not.toBeNull();
    expect(plan.path[0]).toEqual(from);
    const travelMs = (plan.path.length - 1) * 180;
    expect(sweepingPose(plan, travelMs - 1).type).toBe("walking");
    expect(sweepingPose(plan, travelMs)).toMatchObject({ type: "sweeping", position: plan.first });
  }
});
it("approaches the closest front road tile from either side", () => {
  expect(planSweeping(snapshot(), { column: 0, row: 5 }, 1000)?.first).toEqual({ column: 1, row: 5 });
  expect(planSweeping(snapshot(), { column: 3, row: 5 }, 1000)?.first).toEqual({ column: 2, row: 5 });
});
it("rejects carrying, working and obstructed front roads", () => {
  const s = snapshot(), from = { column: 1, row: 5 };
  s.farm.carriedItem = { itemKey: "barley", quantity: 1 };
  expect(planSweeping(s, from, 1000)).toBeNull();
  s.farm.carriedItem = null;
  s.objects = [{ id, type: "rock", column: 2, row: 5 }];
  expect(planSweeping(s, from, 1000)).toBeNull();
  s.objects = [];
  s.farm.roads = [{ column: 5, row: 4, completesAt: 5000 }];
  expect(planSweeping(s, from, 1000)).toBeNull();
});
it("waits rather than teleporting when a distant farmer cannot reach the farm", () => {
  const s = snapshot();
  s.objects = [{ column: 4, row: 9 }, { column: 6, row: 9 }, { column: 5, row: 8 }]
    .map(cell => ({ id, type: "rock" as const, ...cell }));
  expect(planSweeping(s, { column: 5, row: 9 }, 1000)).toBeNull();
});
it("walks at normal speed, sweeps both tiles and loops without teleporting", () => {
  const plan = planSweeping(snapshot(), { column: 0, row: 5 }, 1000)!;
  expect(sweepingPose(plan, 90)).toMatchObject({ type: "walking", position: { column: 0.5, row: 5 } });
  expect(sweepingPose(plan, 180)).toMatchObject({ type: "sweeping", position: plan.first });
  expect(sweepingPose(plan, 180 + SWEEP_DWELL_MS + 90)).toMatchObject({ type: "walking", position: { column: 1.5, row: 5 } });
  expect(sweepingPose(plan, 360 + SWEEP_DWELL_MS)).toMatchObject({ type: "sweeping", position: plan.second });
  expect(sweepingPose(plan, 540 + SWEEP_DWELL_MS * 2)).toMatchObject({ type: "sweeping", position: plan.first });
  expect([0, 267, 534, 800, 1067].map(sweepTexture)).toEqual(["farmer-sweep-0", "farmer-sweep-1", "farmer-sweep-2", "farmer-sweep-3", "farmer-sweep-0"]);
});
