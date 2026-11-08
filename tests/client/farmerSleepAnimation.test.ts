import { expect, it } from "vitest";
import { farmerSleepPose, farmerHomeEntryDuration, SLEEP_FADE_MS, SLEEP_DOOR_APPROACH_MS } from "../../src/client/game/phaser/farmerSleepAnimation";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../src/game-data/movement";
const plan = { path: [{ column: 0, row: 0 }, { column: 1, row: 0 }], doorway: { x: 35, y: 10 } };
it("walks before fading, then remains hidden at the doorway", () => {
  expect(farmerSleepPose(plan, 0, null).alpha).toBe(1);
  expect(farmerSleepPose(plan, WORKER_MOVE_DURATION_PER_TILE + SLEEP_DOOR_APPROACH_MS + SLEEP_FADE_MS / 2, null).alpha).toBeCloseTo(0.5);
  expect(farmerSleepPose(plan, 100000, null)).toMatchObject({ ...plan.doorway, alpha: 0, sleeping: true });
});
it("wakes continuously from a partially faded pose and ends outside", () => {
  const pose = farmerSleepPose(plan, WORKER_MOVE_DURATION_PER_TILE + SLEEP_DOOR_APPROACH_MS + 800, null);
  expect(farmerSleepPose(plan, 0, { ...pose, elapsed: 0 })).toMatchObject({ x: pose.x, y: pose.y, alpha: pose.alpha });
  expect(farmerSleepPose(plan, 0, { ...pose, elapsed: SLEEP_FADE_MS })).toMatchObject({ x: 48, y: 24, alpha: 1, done: true, sleeping: false });
});

it("stays fully visible until reaching the door threshold", () => {
  const pose = farmerSleepPose(plan, WORKER_MOVE_DURATION_PER_TILE + SLEEP_DOOR_APPROACH_MS, null);
  expect(pose).toMatchObject({ x: 23, y: 22, alpha: 1, sleeping: false });
});

it("opens the interior only once travel and the doorway fade have finished", () => {
  for (const entry of [plan, { ...plan, path: [plan.path[0]!] }]) {
    const duration = farmerHomeEntryDuration(entry);
    expect(farmerSleepPose(entry, duration - 1, null).alpha).toBeGreaterThan(0);
    expect(farmerSleepPose(entry, duration, null)).toMatchObject({ alpha: 0, walking: false, ...entry.doorway });
  }
});
