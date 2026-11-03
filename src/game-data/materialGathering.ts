import { z } from "zod";
import { WorkerPositionSchema } from "./productionJourney";

export const MaterialGatheringSchema = z.object({
  itemKey: z.enum(["reed", "clay"]), quantity: z.int().positive(),
  outbound: z.array(WorkerPositionSchema).min(1),
  startedAt: z.number(), workStartsAt: z.number(), workEndsAt: z.number(), completesAt: z.number(),
  stepDurationMs: z.number().positive(), settled: z.boolean(),
  deliveries: z.array(z.object({
    storageId: z.string(), building: WorkerPositionSchema, quantity: z.int().positive(),
    path: z.array(WorkerPositionSchema).min(1), startedAt: z.number(), completesAt: z.number(), settled: z.boolean()
  })).min(1)
});
export type MaterialGathering = z.infer<typeof MaterialGatheringSchema>;
export const materialGatheringReservations = (job: MaterialGathering | null | undefined, itemKey: string): Record<string, number> =>
  !job || job.settled || job.itemKey !== itemKey ? {} : Object.fromEntries(job.deliveries.filter(d => !d.settled).map(d => [d.storageId, d.quantity]));
export const materialGatheringReserved = (job: MaterialGathering | null | undefined, itemKey: string) =>
  Object.values(materialGatheringReservations(job, itemKey)).reduce((sum, n) => sum + n, 0);
