import { eq, sql } from "drizzle-orm";
import { ACHIEVEMENT_TREASURES, earnedAchievements } from "../../game-data/achievementTreasures";
import type { DatabaseTransaction } from "../db/client";
import { farms, pointAwards, shekelTransactions } from "../db/schema";

/** Caller holds the farm lock. History is authoritative; unlocks never expire. */
export const settleAchievementTreasures = async (tx: DatabaseTransaction, farm: typeof farms.$inferSelect) => {
  const previous = farm.progressionStats.achievementTreasures ?? [];
  if (previous.length === ACHIEVEMENT_TREASURES.length) return farm;
  const [history] = await tx.select({
    meals: sql<number>`count(*) filter (where ${pointAwards.action} = 'cookMeal')::int`,
    sesame: sql<number>`count(*) filter (where ${pointAwards.action} = 'harvestSesame')::int`,
    points: sql<number>`coalesce(sum(${pointAwards.points}), 0)::double precision`,
  }).from(pointAwards).where(eq(pointAwards.playerId, farm.playerId));
  const [requests] = await tx.select({ count: sql<number>`count(*)::int` }).from(shekelTransactions)
    .where(sql`${shekelTransactions.playerId} = ${farm.playerId} AND ${shekelTransactions.type} = 'request_reward'`);
  const unlocked = [...new Set([...previous, ...earnedAchievements({
    beer: farm.progressionStats.beerProduced,
    beerRequests: farm.progressionStats.beerRequestsFulfilled ?? 0,
    harvests: farm.progressionStats.harvests + (history?.sesame ?? 0),
    meals: history?.meals ?? 0, requests: requests?.count ?? 0, points: history?.points ?? 0,
  })])];
  if (unlocked.length === previous.length) return farm;
  const changesJar = unlocked.includes("painted-large-jar") && !previous.includes("painted-large-jar");
  const appearance = farm.homeAppearance;
  const furniture = appearance.furniture?.map(item => changesJar && item.key === "plain-jar"
    ? { ...item, key: "painted-large-jar" as const } : item);
  const [updated] = await tx.update(farms).set({
    progressionStats: { ...farm.progressionStats, achievementTreasures: unlocked },
    ...(changesJar ? { homeAppearance: { ...appearance, furniture,
      furnitureRevision: (appearance.furnitureRevision ?? 0) + 1 } } : {}),
    version: sql`${farms.version} + 1`,
  }).where(eq(farms.id, farm.id)).returning();
  return updated!;
};
