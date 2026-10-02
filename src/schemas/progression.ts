import { z } from "zod";
export const ProgressionStatsSchema = z.object({
  level6Baseline: z.object({ produced: z.int().nonnegative(), sold: z.int().nonnegative() }).optional(),
  breadProduced: z.int().nonnegative().default(0),
  processedBarley: z.int().nonnegative().default(0),
  harvestedBarley: z.int().nonnegative(), harvests: z.int().nonnegative(),
  beerProduced: z.int().nonnegative(), fishFed: z.int().nonnegative()
});
export const ProgressionSchema = z.object({
  breadSold: z.int().nonnegative().default(0),
  level: z.int().min(1).max(10), stats: ProgressionStatsSchema,
  barleySold: z.int().nonnegative(), beerSold: z.int().nonnegative(), requestsDelivered: z.int().nonnegative()
});
