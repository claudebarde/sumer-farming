import { z } from "zod";
export const ProgressionStatsSchema = z.object({
  harvestedBarley: z.int().nonnegative(), harvests: z.int().nonnegative(),
  beerProduced: z.int().nonnegative(), fishFed: z.int().nonnegative()
});
export const ProgressionSchema = z.object({
  level: z.int().min(1).max(10), stats: ProgressionStatsSchema,
  barleySold: z.int().nonnegative(), beerSold: z.int().nonnegative(), requestsDelivered: z.int().nonnegative()
});
