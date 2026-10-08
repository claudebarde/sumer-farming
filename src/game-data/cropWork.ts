import { z } from "zod";
import { PerennialCropKeySchema } from "./crops";
import { WorkerPositionSchema } from "./productionJourney";

/** Accepted work is a saved timeline, never an animation-completion callback. */
export const CropWorkSchema = z.object({
  id: z.uuid(), cropId: z.uuid(), cropKey: PerennialCropKeySchema,
  action: z.enum(["plant", "harvest"]),
  startedAt: z.number(), workStartsAt: z.number(), workEndsAt: z.number(), completesAt: z.number(),
  outbound: z.array(WorkerPositionSchema).min(1), inbound: z.array(WorkerPositionSchema).min(1),
  quantity: z.int().nonnegative(), settled: z.boolean().default(false)
});
export type CropWork = z.infer<typeof CropWorkSchema>;
