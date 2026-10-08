import { and, eq, sql } from "drizzle-orm";
import { CROP_DEFINITIONS } from "../../game-data/crops";
import type { DatabaseTransaction } from "../db/client";
import { farmCrops, farmInventory, farms } from "../db/schema";
import type { FarmRecord } from "./farmLifecycle";

/** Called under the farm lock; one receipt prevents duplicate offline harvests. */
export const advancePerennialCropWork = async (tx: DatabaseTransaction, farm: FarmRecord, now: Date): Promise<FarmRecord> => {
  const job = farm.production.cropWork;
  if (!job || job.settled || now.getTime() < job.completesAt) return farm;
  const definition = CROP_DEFINITIONS[job.cropKey];
  let cropYields = farm.production.cropYields ?? {};
  if (job.action === "harvest") {
    const remaining = (cropYields[job.cropId] ?? definition.harvestYield) - job.quantity;
    cropYields = { ...cropYields, [job.cropId]: remaining > 0 ? remaining : definition.harvestYield };
    await tx.update(farmCrops).set({ harvestStartedAt: null, harvestCompletesAt: null,
      ...(remaining === 0 ? { growthCompletesAt: new Date(job.workEndsAt + definition.ripeningDurationMs) } : {})
    }).where(and(eq(farmCrops.id, job.cropId), eq(farmCrops.farmId, farm.id)));
    await tx.insert(farmInventory).values({ farmId: farm.id, itemKey: definition.harvestItemKey, quantity: job.quantity, updatedAt: now })
      .onConflictDoUpdate({ target: [farmInventory.farmId, farmInventory.itemKey], set: { quantity: sql`${farmInventory.quantity} + ${job.quantity}`, updatedAt: now } });
  }
  const [updated] = await tx.update(farms).set({ production: { ...farm.production, cropYields, cropWork: { ...job, settled: true } },
    version: sql`${farms.version} + 1`, updatedAt: now }).where(eq(farms.id, farm.id)).returning();
  return updated!;
};
