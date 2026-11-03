import type { MaterialGathering } from "../../../game-data/materialGathering";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../../game-data/movement";
import { pickupPose } from "./isometricPickup";
import { gatheringRestCell } from "./isometricGathering";

export const materialGatheringPose = (job: MaterialGathering, now: number) => {
  const target = job.outbound.at(-1)!;
  const rest = gatheringRestCell(job.itemKey === "reed" ? { ...target, row: target.row - 0.375 } : target, job.itemKey, false);
  const phase = now < job.workStartsAt ? "approaching" : now < job.workEndsAt ? "gathering" : "delivering";
  const stop = job.deliveries.find(d => now < d.completesAt) ?? job.deliveries.at(-1)!;
  const route = phase === "delivering" ? stop.path : job.outbound;
  const start = phase === "delivering" ? stop.startedAt : job.startedAt;
  const elapsed = Math.max(0, now - start);
  const travel = (route.length - 1) * job.stepDurationMs;
  const scaled = Math.min(elapsed, travel) * WORKER_MOVE_DURATION_PER_TILE / job.stepDurationMs + Math.max(0, elapsed - travel);
  const pose = pickupPose(route, 0, scaled, phase === "delivering" ? stop.building : undefined);
  const walking = phase !== "gathering" && elapsed < (route.length - 1) * job.stepDurationMs;
  const transition = phase === "gathering" ? 1 : phase === "approaching"
    ? Math.max(0, 1 - (job.workStartsAt - now) / job.stepDurationMs)
    : stop === job.deliveries[0] ? Math.max(0, 1 - elapsed / job.stepDurationMs) : 0;
  const position = phase === "gathering" ? target : pose.position;
  return { ...pose, phase, walking, position, visualPosition: {
    column: position.column + (rest.column - target.column) * transition,
    row: position.row + (rest.row - target.row) * transition
  }, facingLeft: phase === "gathering" && job.itemKey === "reed" ? true : pose.facingLeft,
    quantity: phase === "delivering" ? job.deliveries.filter(d => d.completesAt > now).reduce((sum, d) => sum + d.quantity, 0) : 0,
    workElapsed: Math.max(0, now - job.workStartsAt) };
};
