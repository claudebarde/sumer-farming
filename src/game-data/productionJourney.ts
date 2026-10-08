import { z } from "zod";
import { INITIAL_FARM_CONFIG } from "./initialFarm";

const bounds = INITIAL_FARM_CONFIG.worldBounds;
export const WorkerPositionSchema = z.object({
  column: z.int().min(bounds.minimumColumn).max(bounds.maximumColumn),
  row: z.int().min(0).max(INITIAL_FARM_CONFIG.riverRow - 1)
});
export const ProductionJourneySchema = z.object({
  departedAt: z.number(),
  stepDurationMs: z.number().positive(),
  path: z.array(WorkerPositionSchema).min(1),
  supplyIndex: z.int().nonnegative(),
  donkeyPickupIndex: z.int().nonnegative().optional(),
  donkeyDropIndex: z.int().nonnegative().optional()
});
export type ProductionJourney = z.infer<typeof ProductionJourneySchema>;
