import { z } from "zod";

export const LeaderboardQuerySchema = z.object({
  scope: z.enum(["local", "global"]).default("local"),
  metric: z.enum(["level", "shekels", "harvestedBarley"]).default("level")
});
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;
export const LEADERBOARD_METRICS = {
  level: { label: "Estate level", description: "Your current estate level." },
  shekels: { label: "Shekels", description: "Available shekels, excluding money reserved in market orders." },
  harvestedBarley: { label: "Barley harvested", description: "Lifetime barley harvested, not current stock. Buying barley does not count." }
} as const;
export const LeaderboardEntrySchema = z.object({
  playerId: z.string().uuid(), name: z.string(), city: z.string(), neighbourhood: z.string(),
  level: z.number().int().positive().optional(),
  rank: z.number().int().positive(), score: z.number().int().nonnegative(), isYou: z.boolean()
});
export const LeaderboardResponseSchema = z.object({
  scope: LeaderboardQuerySchema.shape.scope, metric: LeaderboardQuerySchema.shape.metric,
  entries: z.array(LeaderboardEntrySchema).max(10), self: LeaderboardEntrySchema.nullable(),
  total: z.number().int().nonnegative(), updatedAt: z.string().datetime()
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;
