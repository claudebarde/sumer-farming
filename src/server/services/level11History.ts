import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../db/client";
import { farms, pointAwards } from "../db/schema";

/** Caller holds the farm lock. Count completed receipts after the proven level entry.
 * Missing history starts now; never infer work from stock or lifetime totals. */
export const readLevel11Work = async (tx: DatabaseTransaction, farm: typeof farms.$inferSelect, now = new Date()) => {
  if (farm.level !== 11) return farm.progressionStats;
  const [entry] = await tx.select({ at: pointAwards.completedAt }).from(pointAwards)
    .where(and(eq(pointAwards.playerId, farm.playerId), eq(pointAwards.source, "level:11")));
  const startedAt = farm.progressionStats.level11StartedAt ?? entry?.at.toISOString() ?? now.toISOString();
  const [work] = await tx.select({
    meals: sql<number>`count(*) filter (where ${pointAwards.action} = 'cookMeal')::int`,
    harvests: sql<number>`count(*) filter (where ${pointAwards.action} in ('harvestBarley', 'harvestSesame'))::int`,
  }).from(pointAwards).where(and(eq(pointAwards.playerId, farm.playerId), gte(pointAwards.completedAt, new Date(startedAt)), lte(pointAwards.completedAt, now)));
  const stats = { ...farm.progressionStats, level11StartedAt: startedAt, level11Work: work ?? { meals: 0, harvests: 0 } };
  if (JSON.stringify(stats) !== JSON.stringify(farm.progressionStats)) {
    await tx.update(farms).set({ progressionStats: stats }).where(eq(farms.id, farm.id));
  }
  return stats;
};
