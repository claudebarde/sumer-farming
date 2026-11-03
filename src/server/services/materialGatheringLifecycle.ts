import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../db/client";
import { farms, farmInventory } from "../db/schema";
import { setStoredQuantity } from "./physicalStorage";

/** Caller holds the farm lock. Release each reservation and credit its deposit atomically. */
export const advanceMaterialGathering = async (tx: DatabaseTransaction, initial: typeof farms.$inferSelect, now: Date) => {
  let farm = initial;
  const job = farm.production.materialGathering;
  if (!job || job.settled) return farm;
  for (let index = 0; index < job.deliveries.length; index++) {
    const stop = farm.production.materialGathering!.deliveries[index]!;
    if (stop.settled || stop.completesAt > now.getTime()) continue;
    const current = farm.production.materialGathering!;
    const deliveries = current.deliveries.map((d, i) => i === index ? { ...d, settled: true } : d);
    const settled = deliveries.every(d => d.settled);
    const [updated] = await tx.update(farms).set({
      production: { ...farm.production, materialGathering: { ...current, deliveries, settled }, materialDelivery: !settled },
      ...(settled ? { gatheringItemKey: null, gatheringColumn: null, gatheringRow: null, gatheringStartedAt: null, gatheringCompletesAt: null } : {}),
      updatedAt: now
    }).where(eq(farms.id, farm.id)).returning();
    farm = updated!;
    const [entry] = await tx.select().from(farmInventory).where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, job.itemKey)));
    await setStoredQuantity(tx, farm.id, job.itemKey, (entry?.quantity ?? 0) + stop.quantity, now, stop.storageId);
  }
  return farm;
};
