import { z } from "zod";
import { CROP_DEFINITIONS } from "./crops";
import { WorkerPositionSchema } from "./productionJourney";

/** Accepted work is a saved timeline, never an animation-completion callback. */
export const CropWorkSchema = z.object({
  id: z.uuid(), cropId: z.uuid(), cropKey: z.enum(["datePalm", "sesame"]),
  action: z.enum(["plant", "harvest", "tend"]),
  startedAt: z.number(), workStartsAt: z.number(), workEndsAt: z.number(), completesAt: z.number(),
  outbound: z.array(WorkerPositionSchema).min(1), inbound: z.array(WorkerPositionSchema).min(1),
  quantity: z.int().nonnegative(), settled: z.boolean().default(false)
});
export type CropWork = z.infer<typeof CropWorkSchema>;

/** Accepted harvests reserve their destination until their saved work settles. */
export const cropWorkReserved = (production: { readonly cropWork?: CropWork | null }, item: string): number => {
  const job = production.cropWork;
  return job && item === CROP_DEFINITIONS[job.cropKey].harvestItemKey && job.action === "harvest" && !job.settled ? job.quantity : 0;
};
