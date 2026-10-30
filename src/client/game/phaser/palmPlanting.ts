import type { CropWork } from "../../../game-data/cropWork";
import type { IsoCell } from "./isometricProjection";
import { positionAlongPorterPath } from "./porterPresentation";

export const palmPlantingPosition = (target: IsoCell): IsoCell => ({
  column: target.column + 27 / 96 + 5 / 48,
  row: target.row - 27 / 96 + 5 / 48
});

/** Present the saved schedule; never acknowledge work or change its deadline. */
export const palmPlantingPose = (job: CropWork, target: IsoCell, now: number) => {
  const destination = job.cropKey === "sesame" ? target : palmPlantingPosition(target);
  const path = [...job.outbound.slice(0, -1), destination];
  const traveling = now < job.workStartsAt;
  const working = now >= job.workStartsAt && now < job.workEndsAt;
  const fraction = Math.max(0, Math.min(1, (now - job.startedAt) / Math.max(1, job.workStartsAt - job.startedAt)));
  return { position: traveling ? positionAlongPorterPath(path, fraction) : destination,
    traveling, working, percentage: Math.round(Math.max(0, Math.min(1,
      (now - job.workStartsAt) / Math.max(1, job.workEndsAt - job.workStartsAt))) * 100),
    remainingSeconds: Math.max(0, Math.ceil((job.workEndsAt - now) / 1000)) };
};
