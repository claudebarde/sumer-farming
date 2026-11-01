import type { MillingJob } from "./milling";
import { productionIsPreparing } from "./productionPreparation";

/** The original slot remains readable for saved jobs; concurrent donkey work has its own slot. */
export type MillingState = {
  readonly milling?: MillingJob | null;
  readonly production?: { readonly donkeyMilling?: MillingJob | null };
};
export const millingJobs = (farm: MillingState): readonly MillingJob[] =>
  [farm.milling, farm.production?.donkeyMilling].filter((job): job is MillingJob => !!job);
export const millingJobForBuilding = (farm: MillingState, buildingId: string) =>
  millingJobs(farm).find(job => job.buildingId === buildingId);
export const donkeyMillingJob = (farm: MillingState) => millingJobs(farm).find(job => job.worker === "donkey");
export const farmerMillingJob = (farm: MillingState, now: number) =>
  millingJobs(farm).find(job => job.worker !== "donkey" || productionIsPreparing(job, now));
