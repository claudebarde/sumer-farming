import { and, asc, eq, lte } from "drizzle-orm";
import { match } from "ts-pattern";

import { FARM_BUILDING_DEFINITIONS } from "../../game-data/buildings";
import type { MarketItemKey } from "../../game-data/marketItems";
import { FARM_STORAGE_CAPACITY } from "../../game-data/storage";
import type { DatabaseTransaction } from "../db/client";
import { farmBuildings, farmInventory } from "../db/schema";

type CompletedGranary = {
  readonly id: string;
  readonly storedBarley: number;
};

export type MarketItemStorage = {
  readonly type: "barley_storage" | "estate_inventory";
  readonly itemKey: MarketItemKey;
  readonly farmId: string;
  readonly farmQuantity: number;
  readonly granaries: readonly CompletedGranary[];
  readonly storedQuantity: number;
  readonly totalCapacity: number;
  readonly availableCapacity: number;
};

const updateFarmInventory = async (
  transaction: DatabaseTransaction,
  storage: MarketItemStorage,
  nextQuantity: number,
  now: Date
): Promise<void> => {
  if (nextQuantity === storage.farmQuantity) {
    return;
  }

  if (nextQuantity === 0) {
    await transaction
      .delete(farmInventory)
      .where(
        and(
          eq(farmInventory.farmId, storage.farmId),
          eq(farmInventory.itemKey, storage.itemKey)
        )
      );
    return;
  }

  await transaction
    .insert(farmInventory)
    .values({
      farmId: storage.farmId,
      itemKey: storage.itemKey,
      quantity: nextQuantity,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: [farmInventory.farmId, farmInventory.itemKey],
      set: { quantity: nextQuantity, updatedAt: now }
    });
};

const loadBarleyStorage = async (
  transaction: DatabaseTransaction,
  farmId: string,
  now: Date
): Promise<MarketItemStorage> => {
  const farmQuantity = (
    await transaction
      .select({ quantity: farmInventory.quantity })
      .from(farmInventory)
      .where(
        and(
          eq(farmInventory.farmId, farmId),
          eq(farmInventory.itemKey, "barley")
        )
      )
      .limit(1)
      .for("update")
  )[0]?.quantity ?? 0;
  const granaries = await transaction
    .select({
      id: farmBuildings.id,
      storedBarley: farmBuildings.storedBarley
    })
    .from(farmBuildings)
    .where(
      and(
        eq(farmBuildings.farmId, farmId),
        eq(farmBuildings.type, "granary"),
        lte(farmBuildings.completesAt, now)
      )
    )
    .orderBy(asc(farmBuildings.completesAt), asc(farmBuildings.id))
    .for("update");
  const storedQuantity =
    farmQuantity +
    granaries.reduce(
      (quantity, granary) => quantity + granary.storedBarley,
      0
    );
  const totalCapacity =
    FARM_STORAGE_CAPACITY +
    granaries.length * FARM_BUILDING_DEFINITIONS.granary.barleyStorageBonus;

  return {
    type: "barley_storage",
    itemKey: "barley",
    farmId,
    farmQuantity,
    granaries,
    storedQuantity,
    totalCapacity,
    availableCapacity: totalCapacity - storedQuantity
  };
};

export const loadMarketItemStorage = (
  transaction: DatabaseTransaction,
  farmId: string,
  itemKey: MarketItemKey,
  now: Date
): Promise<MarketItemStorage> =>
  match(itemKey)
    .returnType<Promise<MarketItemStorage>>()
    .with("barley", () => loadBarleyStorage(transaction, farmId, now))
    .with("brewingVessels", "emptyBeerJar", "beer", async () => {
      const [entry] = await transaction.select().from(farmInventory).where(and(eq(farmInventory.farmId, farmId), eq(farmInventory.itemKey, itemKey))).for("update");
      const quantity = entry?.quantity ?? 0;
      return { type: "estate_inventory", itemKey, farmId, farmQuantity: quantity, granaries: [], storedQuantity: quantity, totalCapacity: 2147483647, availableCapacity: 2147483647 - quantity };
    })
    .exhaustive();

export const removeFromMarketItemStorage = async (
  transaction: DatabaseTransaction,
  storage: MarketItemStorage,
  quantity: number,
  now: Date
): Promise<void> => {
  const removedFromFarm = Math.min(storage.farmQuantity, quantity);
  await updateFarmInventory(
    transaction,
    storage,
    storage.farmQuantity - removedFromFarm,
    now
  );

  let remaining = quantity - removedFromFarm;

  for (const granary of storage.granaries) {
    if (remaining === 0) {
      break;
    }

    const removed = Math.min(granary.storedBarley, remaining);

    if (removed > 0) {
      await transaction
        .update(farmBuildings)
        .set({ storedBarley: granary.storedBarley - removed })
        .where(eq(farmBuildings.id, granary.id));
      remaining -= removed;
    }
  }
};

export const addToMarketItemStorage = async (
  transaction: DatabaseTransaction,
  storage: MarketItemStorage,
  quantity: number,
  now: Date
): Promise<void> => {
  if (storage.type === "estate_inventory") {
    await updateFarmInventory(transaction, storage, storage.farmQuantity + quantity, now);
    return;
  }
  const addedToFarm = Math.min(
    FARM_STORAGE_CAPACITY - storage.farmQuantity,
    quantity
  );
  await updateFarmInventory(
    transaction,
    storage,
    storage.farmQuantity + addedToFarm,
    now
  );

  let remaining = quantity - addedToFarm;
  const granaryCapacity =
    FARM_BUILDING_DEFINITIONS.granary.barleyStorageBonus;

  for (const granary of storage.granaries) {
    if (remaining === 0) {
      break;
    }

    const added = Math.min(granaryCapacity - granary.storedBarley, remaining);

    if (added > 0) {
      await transaction
        .update(farmBuildings)
        .set({ storedBarley: granary.storedBarley + added })
        .where(eq(farmBuildings.id, granary.id));
      remaining -= added;
    }
  }
};
