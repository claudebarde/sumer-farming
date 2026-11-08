import { WORKER_MOVE_DURATION_PER_TILE } from "../../../game-data/movement";
import { isoPoint, type IsoCell } from "./isometricProjection";

export const SLEEP_FADE_MS = 1600;
export const SLEEP_DOOR_APPROACH_MS = 900;
export type FarmerSleepPlan = { readonly path: readonly IsoCell[]; readonly doorway: { readonly x: number; readonly y: number } };
export const farmerHomeEntryDuration = (plan: FarmerSleepPlan): number =>
  (plan.path.length - 1) * WORKER_MOVE_DURATION_PER_TILE + SLEEP_DOOR_APPROACH_MS + SLEEP_FADE_MS;
/** Pure presentation timeline. Never changes saved work or happiness. */
export const farmerSleepPose = (plan: FarmerSleepPlan, elapsed: number, wake: { elapsed: number; alpha: number; x: number; y: number } | null) => {
  const travelMs = (plan.path.length - 1) * WORKER_MOVE_DURATION_PER_TILE;
  const outside = isoPoint(plan.path.at(-1)!);
  if (wake) {
    const t = Math.min(1, wake.elapsed / SLEEP_FADE_MS);
    return { x: wake.x + (outside.x - wake.x) * t, y: wake.y + (outside.y - wake.y) * t,
      alpha: wake.alpha + (1 - wake.alpha) * t, walking: t < 1, sleeping: false, done: t === 1, facingLeft: outside.x < wake.x, distance: t * 48 };
  }
  if (elapsed < travelMs) {
    const step = elapsed / WORKER_MOVE_DURATION_PER_TILE, index = Math.floor(step), t = step - index;
    const a = isoPoint(plan.path[index]!), b = isoPoint(plan.path[index + 1]!);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
      alpha: 1, walking: true, sleeping: false, done: false, facingLeft: b.x < a.x, distance: step * Math.hypot(b.x - a.x, b.y - a.y) };
  }
  const threshold = { x: plan.doorway.x - 12, y: plan.doorway.y + 12 };
  const approach = Math.min(1, (elapsed - travelMs) / SLEEP_DOOR_APPROACH_MS);
  if (approach < 1) return {
    x: outside.x + (threshold.x - outside.x) * approach, y: outside.y + (threshold.y - outside.y) * approach,
    alpha: 1, walking: true, sleeping: false, done: false, facingLeft: false, distance: approach * 48,
  };
  const t = Math.min(1, (elapsed - travelMs - SLEEP_DOOR_APPROACH_MS) / SLEEP_FADE_MS);
  return { x: threshold.x + (plan.doorway.x - threshold.x) * t, y: threshold.y + (plan.doorway.y - threshold.y) * t,
    alpha: 1 - t, walking: t < 1, sleeping: t === 1, done: false, facingLeft: false, distance: t * 48 };
};
