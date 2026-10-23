import { and, eq } from "drizzle-orm";
import { changeStorageLocations, physicalStorageItem, storedLocations, type StorageLocations } from "../../game-core/farm/physicalStorage";
import type { InventoryItemKey } from "../../game-data/inventoryItems";
import type { DatabaseTransaction } from "../db/client";
import { farmBuildings, farmInventory, farms } from "../db/schema";

/** Call under the farm transaction lock. Total and physical locations commit together. */
export const setStoredQuantity = async (tx: DatabaseTransaction, farmId: string, itemKey: InventoryItemKey,
  quantity: number, now: Date, destination?: string, explicitLocations?: StorageLocations) => {
  const [entry] = await tx.select().from(farmInventory)
    .where(and(eq(farmInventory.farmId, farmId), eq(farmInventory.itemKey, itemKey))).for("update");
  const buildings = physicalStorageItem(itemKey) ? await tx.select().from(farmBuildings).where(eq(farmBuildings.farmId, farmId)) : [];
  const [farm] = await tx.select({ production: farms.production }).from(farms).where(eq(farms.id, farmId));
  const job = farm?.production.porter?.job;
  const reserved = !destination && job?.itemKey === itemKey && job.storageId ? { [job.storageId]: job.quantity } : {};
  const locations = physicalStorageItem(itemKey) ? explicitLocations ?? changeStorageLocations(itemKey,
    storedLocations(entry, buildings, now.getTime()), quantity - (entry?.quantity ?? 0), buildings, now.getTime(), destination, reserved) : null;
  if (!Number.isSafeInteger(quantity) || quantity < 0 || (locations && (Object.values(locations).some(q => !Number.isSafeInteger(q) || q < 0) || Object.values(locations).reduce((sum, q) => sum + q, 0) !== quantity))) throw new Error("Invalid physical inventory total.");
  if (quantity === 0 && !physicalStorageItem(itemKey)) {
    await tx.delete(farmInventory).where(and(eq(farmInventory.farmId, farmId), eq(farmInventory.itemKey, itemKey)));
    return;
  }
  await tx.insert(farmInventory).values({ farmId, itemKey, quantity, locations: locations ? { ...locations } : null, updatedAt: now })
    .onConflictDoUpdate({ target: [farmInventory.farmId, farmInventory.itemKey], set: { quantity, locations: locations ? { ...locations } : null, updatedAt: now } });
};

export const initializePhysicalStorage = async (tx: DatabaseTransaction, farmId: string, now: Date) => {
  const entries = await tx.select().from(farmInventory).where(eq(farmInventory.farmId, farmId));
  const buildings = await tx.select().from(farmBuildings).where(eq(farmBuildings.farmId, farmId));
  for (const entry of entries) if (physicalStorageItem(entry.itemKey) && entry.locations === null) {
    await tx.update(farmInventory).set({ locations: { ...storedLocations(entry, buildings, now.getTime()) } })
      .where(and(eq(farmInventory.farmId, farmId), eq(farmInventory.itemKey, entry.itemKey)));
  }
};
