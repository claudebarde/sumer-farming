import { z } from "zod";
import { CROP_DEFINITIONS } from "./crops";
import { WorkerPositionSchema } from "./productionJourney";

/** Accepted work is a saved timeline, never an animation-completion callback. */
export const CropWorkSchema = z.object({
  batch: z.object({ id: z.uuid(), index: z.int().nonnegative(), total: z.int().positive() }).optional(),
  id: z.uuid(), cropId: z.uuid(), cropKey: z.enum(["datePalm", "sesame"]),
  action: z.enum(["plant", "harvest", "tend"]),
  startedAt: z.number(), workStartsAt: z.number(), workEndsAt: z.number(), completesAt: z.number(),
  outbound: z.array(WorkerPositionSchema).min(1), inbound: z.array(WorkerPositionSchema).min(1),
  quantity: z.int().nonnegative(), settled: z.boolean().default(false)
});
export type CropWork = z.infer<typeof CropWorkSchema>;

type CropWorkState = { readonly cropWork?: CropWork | null; readonly cropWorkQueue?: readonly CropWork[] };

/** Presentation follows saved deadlines even between server refreshes. */
export const currentCropWork = (production: CropWorkState, now: number): CropWork | null => {
  const jobs = [production.cropWork, ...(production.cropWorkQueue ?? [])].filter((job): job is CropWork => !!job);
  return jobs.find(job => !job.settled && now < job.completesAt) ?? jobs.at(-1) ?? null;
};

/** Every accepted harvest reserves space until its saved delivery settles. */
export const cropWorkReserved = (production: CropWorkState, item: string): number =>
  [production.cropWork, ...(production.cropWorkQueue ?? [])].reduce((total, job) => total +
    (job && item === CROP_DEFINITIONS[job.cropKey].harvestItemKey && job.action === "harvest" && !job.settled ? job.quantity : 0), 0);
