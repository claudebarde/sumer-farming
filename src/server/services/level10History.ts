import { eq } from "drizzle-orm";
import { millingJobs } from "../../game-data/millingJobs";
import type { DatabaseTransaction } from "../db/client";
import { farmBuildings, farms, pointAwards } from "../db/schema";
import type { FarmRecord } from "./farmLifecycle";

/** One-time recovery from verifiable receipts, never stock or purchases.
 * Active jobs are excluded: their normal completion will increment the counters.
 * Both activities first unlock at level 10. Missing old receipts mean zero credit. */
export const initializeLevel10Work = async (tx: DatabaseTransaction, farm: FarmRecord): Promise<FarmRecord> => {
  if (farm.level !== 10 || farm.progressionStats.level10Work) return farm;
  const receipts = await tx.select().from(pointAwards).where(eq(pointAwards.playerId, farm.playerId));
  const buildings = await tx.select().from(farmBuildings).where(eq(farmBuildings.farmId, farm.id));
  const oilMills = new Set(buildings.filter(b => b.type === "oilMill").map(b => b.id));
  const pending = new Set([
    ...millingJobs(farm).map(job => `mill:${job.buildingId}:${job.startedAt}`),
    ...[farm.production.cropWork, ...(farm.production.cropWorkQueue ?? [])]
      .filter(job => job && !job.settled).map(job => `crop-work:${job!.id}`)
  ]);
  const history = receipts.filter(receipt => !pending.has(receipt.source));
  const level10Work = {
    sesameHarvests: history.filter(receipt => receipt.action === "harvestSesame").length,
    oilProduced: history.filter(receipt => receipt.source.startsWith("mill:") && oilMills.has(receipt.source.split(":")[1]!))
      .reduce((sum, receipt) => sum + (receipt.action === "millDonkey" ? 3 : receipt.action === "millFarmer" ? 1 : 0), 0)
  };
  const progressionStats = { ...farm.progressionStats, level10Work };
  await tx.update(farms).set({ progressionStats }).where(eq(farms.id, farm.id));
  return { ...farm, progressionStats };
};
