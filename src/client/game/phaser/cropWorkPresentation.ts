import type { CropWork } from "../../../game-data/cropWork";
import { positionAlongPorterPath } from "./porterPresentation";

export const cropWorkPresentation = (job: CropWork, now: number) => {
  const outbound = now < job.workStartsAt;
  const working = now >= job.workStartsAt && now < job.workEndsAt;
  const carrying = job.action === "harvest" && now >= job.workEndsAt && now < job.completesAt;
  const position = outbound
    ? positionAlongPorterPath(job.outbound, (now - job.startedAt) / Math.max(1, job.workStartsAt - job.startedAt))
    : working ? job.outbound.at(-1)!
    : positionAlongPorterPath(job.inbound, (now - job.workEndsAt) / Math.max(1, job.completesAt - job.workEndsAt));
  return { position, working, carrying, moving: outbound || carrying };
};
