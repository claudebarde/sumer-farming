import type { MillingJob } from "../../../game-data/milling";
import { isoPoint, type IsoCell } from "./isometricProjection";
import { DONKEY_STEP_MS } from "./isometricDonkey";

export const donkeyEscortPath = (job: MillingJob) => {
  const journey = job.preparation;
  if (job.worker !== "donkey" || !journey || journey.donkeyPickupIndex === undefined || journey.donkeyDropIndex === undefined) return [];
  return journey.path.slice(journey.donkeyPickupIndex, journey.donkeyDropIndex + 1);
};

const pathPose = (path: readonly IsoCell[], step: number) => {
  const at = Math.max(0, Math.min(path.length - 1, step));
  const index = Math.min(Math.floor(at), Math.max(0, path.length - 2));
  const from = path[index]!, to = path[index + 1] ?? from;
  const fraction = at - index;
  return { position: { column: from.column + (to.column - from.column) * fraction,
    row: from.row + (to.row - from.row) * fraction }, facingLeft: isoPoint(to).x < isoPoint(from).x };
};

/** Saved server time drives escort poses, including reloads halfway through a trip. */
export const donkeyMillingPose = (job: MillingJob, now: number) => {
  const path = donkeyEscortPath(job), journey = job.preparation;
  if (!path.length || !journey) return null;
  const pickupAt = journey.departedAt + journey.donkeyPickupIndex! * journey.stepDurationMs;
  const completeAt = Date.parse(job.completesAt);
  if (now >= completeAt) {
    const returnPath = [...path].reverse();
    const step = (now - completeAt) / DONKEY_STEP_MS;
    const walking = step < returnPath.length - 1;
    return { ...pathPose(returnPath, step), phase: walking ? "returning" as const : "resting" as const,
      walking, elapsed: now - completeAt };
  }
  // Follow the same path rather than offsetting into nearby buildings.
  const step = Math.max(0, (now - pickupAt) / journey.stepDurationMs - 0.65);
  if (now < pickupAt || (step === 0 && path.length > 1)) {
    return { ...pathPose(path, 0), phase: "waiting" as const, walking: false, elapsed: 0 };
  }
  if (step >= path.length - 1) return null; // Inside during supply/work.
  return { ...pathPose(path, step), phase: "following" as const, walking: true,
    elapsed: step * DONKEY_STEP_MS };
};
