import type { CropWork } from "../../game-data/cropWork";
import { palmHarvestPose } from "../game/phaser/palmHarvesting";
import WorkProgress from "./WorkProgress";
import sesame from "../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-basket-isometric.png";
import baskets from "../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/baskets-dates.webp";

export default function PalmHarvestProgress({ job, now }: { job: CropWork; now: number }) {
  const pose = palmHarvestPose(job, job.outbound.at(-1)!, now);
  const resource = job.cropKey === "sesame" ? "sesame" : "dates";
  const label = pose.phase === "approaching" ? `Walking to harvest ${resource}…` : pose.phase === "harvesting" ? `Harvesting ${resource}…` : `Delivering ${resource} to warehouse…`;
  return <WorkProgress icon={job.cropKey === "sesame" ? sesame : baskets} label={label}
    details={job.batch && <p>{job.batch.index + 1}/{job.batch.total} fields</p>}
    remainingSeconds={pose.remainingSeconds} percentage={pose.percentage} />;
}
