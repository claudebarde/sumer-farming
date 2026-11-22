import { readFarmSnapshot } from "./farmSnapshot";
import { eq, sql } from "drizzle-orm";
import { attend, attendanceAt, utcDay } from "../../game-data/attendance";
import type { Database, DatabaseTransaction } from "../db/client";
import { farms, pointAwards, shekelTransactions } from "../db/schema";

/** Called with the farm locked. Passive polling never extends the activity window. */
export const settleAttendance = async (tx: DatabaseTransaction, farm: typeof farms.$inferSelect, now: Date, traded = false) => {
  const previous = farm.progressionStats.attendance;
  if (!previous) return farm;
  let next = attendanceAt(previous, now.getTime());
  if (next.lastDay !== utcDay(now.getTime()) && (next.activeUntil ?? 0) >= now.getTime()) {
    const [work] = await tx.select({ source: pointAwards.source }).from(pointAwards).where(sql`${pointAwards.playerId} = ${farm.playerId}
      AND ${pointAwards.completedAt} >= ${new Date(utcDay(now.getTime()) * 86400000)}
      AND ${pointAwards.completedAt} <= ${now}
      AND ${pointAwards.action} <> 'zigguratStage'`).limit(1);
    const [trade] = traded ? await tx.select({ id: shekelTransactions.id }).from(shekelTransactions)
      .where(sql`${shekelTransactions.playerId} = ${farm.playerId}
        AND ${shekelTransactions.createdAt} >= ${new Date(utcDay(now.getTime()) * 86400000)}
        AND ${shekelTransactions.createdAt} <= ${now}
        AND (${shekelTransactions.type} IN ('market_purchase', 'request_reward') OR (${shekelTransactions.type} = 'market_sale' AND ${shekelTransactions.source} = 'npc'))`).limit(1) : [];
    if (trade || work) next = attend(next, now.getTime());
  }
  if (JSON.stringify(previous) === JSON.stringify(next)) return farm;
  const removed = !next.unlocked && farm.homeAppearance.furniture?.some(item => item.key === "potted-myrtle");
  const [updated] = await tx.update(farms).set({
    progressionStats: { ...farm.progressionStats, attendance: next },
    ...(removed ? { homeAppearance: { ...farm.homeAppearance,
      furniture: farm.homeAppearance.furniture?.filter(item => item.key !== "potted-myrtle"),
      furnitureRevision: (farm.homeAppearance.furnitureRevision ?? 0) + 1 } } : {}),
    version: sql`${farms.version} + 1`,
  }).where(eq(farms.id, farm.id)).returning();
  return updated!;
};

/** Only accepted player commands call this, never snapshot reads or presence heartbeats. */
export const recordAttendanceActivity = (db: Database, playerId: string, command: string, interactionStartedAt = new Date()) => db.transaction(async tx => {
  const now = new Date();
  const [farm] = await tx.select().from(farms).where(eq(farms.playerId, playerId)).for("update");
  if (!farm) return;
  const [active] = await tx.update(farms).set({ progressionStats: { ...farm.progressionStats,
    attendance: { ...attendanceAt(farm.progressionStats.attendance, now.getTime()), activeUntil: interactionStartedAt.getTime() + 300000 } },
  }).where(eq(farms.id, farm.id)).returning();
  const settled = await settleAttendance(tx, active!, now, ["buy_from_npc_market", "sell_to_npc_market", "buy_market_sell_order", "deliver_npc_request"].includes(command));
  return readFarmSnapshot(tx, settled, false);
});
