import type { CropWork } from "../../../game-data/cropWork";
import { isoPoint, type IsoCell } from "./isometricProjection";
import { farmerDateCarryTexture } from "./farmerDateCarry";
import { palmPlantingPosition } from "./palmPlanting";
import { positionAlongPorterPath } from "./porterPresentation";

/** The server schedule owns every phase, including return after time away. */
export const palmHarvestPose = (job: CropWork, target: IsoCell, now: number) => {
  const workPosition = job.cropKey === "sesame" ? target : palmPlantingPosition(target);
  const phase = now < job.workStartsAt ? "approaching" : now < job.workEndsAt ? "harvesting"
    : now < job.completesAt ? "delivering" : "complete";
  const outbound = [...job.outbound.slice(0, -1), workPosition];
  const inbound = [workPosition, ...job.inbound.slice(1)];
  const fraction = (start: number, end: number) => Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));
  const position = phase === "approaching" ? positionAlongPorterPath(outbound, fraction(job.startedAt, job.workStartsAt))
    : phase === "harvesting" ? workPosition
    : phase === "complete" ? job.inbound.at(-1)! : positionAlongPorterPath(inbound, fraction(job.workEndsAt, job.completesAt));
  const start = phase === "delivering" ? job.workEndsAt : job.workStartsAt;
  const end = phase === "delivering" ? job.completesAt : job.workEndsAt;
  return { phase, position, elapsed: Math.max(0, now - job.workStartsAt),
    percentage: Math.round(fraction(start, end) * 100), remainingSeconds: Math.max(0, Math.ceil((end - now) / 1000)) };
};

/** Only the saved delivery leg carries baskets; no animation callback settles goods. */
export const palmHarvestCarrier = (job: CropWork, target: IsoCell, now: number, reducedMotion = false) => {
  const pose = palmHarvestPose(job, target, now);
  if (pose.phase !== "delivering") return null;
  const point = isoPoint(pose.position);
  const previous = isoPoint(palmHarvestPose(job, target, Math.max(job.workEndsAt, now - 1)).position);
  const next = isoPoint(palmHarvestPose(job, target, Math.min(job.completesAt, now + 1)).position);
  return { texture: farmerDateCarryTexture(now - job.workEndsAt, !reducedMotion),
    // Artwork faces left; mirror only when moving right, including the first frame.
    flipX: next.x > previous.x || (next.x === previous.x && point.x > previous.x) };
};
