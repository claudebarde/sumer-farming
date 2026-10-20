import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { planSweeping, planReturningSweep, sweepingPose, sweepTexture, sweepStopDeadline, sweepOriginX, SWEEP_ORIGIN, SWEEP_IDLE_DELAY, SWEEP_DWELL_MS } from "../../src/client/game/phaser/farmerSweeping";
it("alternates facing between passes from either starting tile and preserves the foot anchor", () => {
  for (const column of [1, 2]) {
    const first = { column, row: 5 }, second = { column: column === 1 ? 2 : 1, row: 5 };
    const plan = { path: [first], first, second };
    const leg = SWEEP_DWELL_MS + 180;
    expect(sweepingPose(plan, 0).facingLeft).toBe(column === 2);
    expect(sweepingPose(plan, SWEEP_DWELL_MS - 1).facingLeft).toBe(column === 2);
    expect(sweepingPose(plan, leg).facingLeft).toBe(column !== 2);
    expect(sweepingPose(plan, leg * 2).facingLeft).toBe(column === 2);
  }
  expect(sweepOriginX(false)).toBe(SWEEP_ORIGIN.x);
  expect(sweepOriginX(true)).toBe(1 - SWEEP_ORIGIN.x);
});
it("delays stopping by two seconds from the first input without extending on repeated input", () => {
  const deadline = sweepStopDeadline(null, 1000);
  expect(deadline).toBe(3000);
  expect(sweepStopDeadline(deadline, 2500)).toBe(3000);
  expect(sweepStopDeadline(null, 4000)).toBe(6000);
});
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
it("returns directly to sweeping only after ten seconds away while eligible", () => {
  const s = snapshot(), from = { column: 5, row: 9 };
  expect(planReturningSweep(s, from, null, 11000)).toBeNull();
  expect(planReturningSweep(s, from, 1000, 10999)).toBeNull();
  const before = JSON.stringify(s);
  for (const now of [11000, 86_400_000]) {
    const plan = planReturningSweep(s, from, 1000, now)!;
    expect(plan.path).toEqual([plan.first]);
    expect(sweepingPose(plan, 0)).toMatchObject({ type: "sweeping", position: plan.first });
  }
  expect(JSON.stringify(s)).toBe(before);
});
it("does not catch up sweeping with cargo, work or blocked access", () => {
  const s = snapshot(), from = { column: 5, row: 9 };
  s.farm.carriedItem = { itemKey: "water", quantity: 1 };
  expect(planReturningSweep(s, from, 1000, 11000)).toBeNull();
  s.farm.carriedItem = null;
  s.farm.roads = [{ column: 5, row: 4, completesAt: 20000 }];
  expect(planReturningSweep(s, from, 1000, 11000)).toBeNull();
  s.farm.roads = [];
  s.objects = [{ id, type: "rock", column: 2, row: 5 }];
  expect(planReturningSweep(s, from, 1000, 11000)).toBeNull();
  s.objects = [{ column: 4, row: 9 }, { column: 6, row: 9 }, { column: 5, row: 8 }]
    .map(cell => ({ id, type: "rock" as const, ...cell }));
  expect(planReturningSweep(s, from, 1000, 11000)).toBeNull();
});
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
