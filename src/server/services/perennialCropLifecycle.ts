import { and, eq, sql } from "drizzle-orm";
import { CROP_DEFINITIONS } from "../../game-data/crops";
import type { DatabaseTransaction } from "../db/client";
import { farmCrops, farmInventory, farms } from "../db/schema";
import type { FarmRecord } from "./farmLifecycle";
import { setStoredQuantity } from "./physicalStorage";

/** Called under the farm lock; one receipt prevents duplicate offline harvests. */
export const advancePerennialCropWork = async (tx: DatabaseTransaction, farm: FarmRecord, now: Date): Promise<FarmRecord> => {
  // At most eight fields; advance every due delivery, including offline catch-up.
  for (let step = 0; step < 8; step++) {
  const job = farm.production.cropWork;
  if (!job || job.settled || now.getTime() < job.completesAt) return farm;
  const definition = CROP_DEFINITIONS[job.cropKey];
  let cropYields = farm.production.cropYields ?? {};
  let palmCycles = farm.production.palmCycles;
  if (job.action === "harvest") {
    if (job.cropKey === "sesame") {
      await tx.delete(farmCrops).where(and(eq(farmCrops.id, job.cropId), eq(farmCrops.farmId, farm.id)));
      cropYields = Object.fromEntries(Object.entries(cropYields).filter(([id]) => id !== job.cropId));
    } else {
      const definition = CROP_DEFINITIONS.datePalm;
      const remaining = (cropYields[job.cropId] ?? definition.harvestYield) - job.quantity;
      cropYields = { ...cropYields, [job.cropId]: remaining > 0 ? remaining : definition.harvestYield };
      if (remaining === 0) palmCycles = { ...palmCycles, [job.cropId]: {
        startedAt: job.workEndsAt, originalReadyAt: job.workEndsAt + definition.ripeningDurationMs
      } };
      await tx.update(farmCrops).set({ harvestStartedAt: null, harvestCompletesAt: null,
        ...(remaining === 0 ? { growthCompletesAt: new Date(job.workEndsAt + definition.ripeningDurationMs) } : {})
      }).where(and(eq(farmCrops.id, job.cropId), eq(farmCrops.farmId, farm.id)));
    }
    const [entry] = await tx.select().from(farmInventory).where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, definition.harvestItemKey)));
    await setStoredQuantity(tx, farm.id, definition.harvestItemKey, (entry?.quantity ?? 0) + job.quantity, now);
  }
  const [updated] = await tx.update(farms).set({
    ...(job.action === "harvest" && job.cropKey === "datePalm" ? { progressionStats: { ...farm.progressionStats, datesStored: (farm.progressionStats.datesStored ?? 0) + job.quantity } } : {}),
    production: { ...farm.production, cropYields, palmCycles, cropWork: farm.production.cropWorkQueue?.[0] ?? { ...job, settled: true }, cropWorkQueue: farm.production.cropWorkQueue?.slice(1) },
    version: sql`${farms.version} + 1`, updatedAt: now }).where(eq(farms.id, farm.id)).returning();
  farm = updated!;
  }
  return farm;
};
