import { and, asc, eq, lte, sql } from "drizzle-orm";

import { BARLEY_CONSUMPTION_INTERVAL_MS } from "../../game-data/household";
import { advanceHappiness } from "../../game-core/farm/wellbeing";
import type { DatabaseTransaction } from "../db/client";
import {
  farmBuildings,
  farmGroundItems,
  farmInventory,
  farms
} from "../db/schema";

export type FarmRecord = typeof farms.$inferSelect;

const consumeFarmBarley = async (
  transaction: DatabaseTransaction,
  farmId: string,
  available: number,
  requested: number
): Promise<number> => {
  const consumed = Math.min(available, requested);

  if (consumed === 0) {
    return 0;
  }

  if (consumed === available) {
    await transaction
      .delete(farmInventory)
      .where(
        and(
          eq(farmInventory.farmId, farmId),
          eq(farmInventory.itemKey, "barley")
        )
      );
  } else {
    await transaction
      .update(farmInventory)
      .set({ quantity: available - consumed })
      .where(
        and(
          eq(farmInventory.farmId, farmId),
          eq(farmInventory.itemKey, "barley")
        )
      );
  }

  return consumed;
};

export const advanceFarmLifecycle = async (
  transaction: DatabaseTransaction,
  farm: FarmRecord,
  now: Date
): Promise<FarmRecord> => {
  if (farm.milling && Date.parse(farm.milling.completesAt) <= now.getTime()) {
    const job = farm.milling;
    const bags = farm.millGoods.pending[job.buildingId] ?? { flour: 0, brewersGroats: 0 };
    const [completed] = await transaction.update(farms).set({ milling: null,
      millGoods: { ...farm.millGoods, pending: { ...farm.millGoods.pending,
        [job.buildingId]: { ...bags, [job.recipe]: bags[job.recipe] + job.output } } },
      progressionStats: { ...farm.progressionStats, processedBarley: (farm.progressionStats.processedBarley ?? 0) + job.barley },
      version: sql`${farms.version} + 1`, updatedAt: now
    }).where(eq(farms.id, farm.id)).returning();
    farm = completed!;
  }
  await transaction
    .delete(farmGroundItems)
    .where(
      and(
        eq(farmGroundItems.farmId, farm.id),
        eq(farmGroundItems.itemKey, "barley"),
        lte(farmGroundItems.expiresAt, now)
      )
    );

  const carriedBarleyExpired =
    farm.carriedItemKey === "barley" &&
    farm.carriedItemExpiresAt !== null &&
    farm.carriedItemExpiresAt <= now;
  const nextConsumptionAt = farm.nextBarleyConsumptionAt;
  const dueRations =
    farm.hungrySince !== null
      ? 1
      : nextConsumptionAt !== null && nextConsumptionAt <= now
        ? Math.floor(
            (now.getTime() - nextConsumptionAt.getTime()) /
              BARLEY_CONSUMPTION_INTERVAL_MS
          ) + 1
        : 0;

  let hungrySince = farm.hungrySince;
  let nextBarleyConsumptionAt = nextConsumptionAt;
  let consumedRations = 0;

  if (dueRations > 0) {
    const farmBarley = (
      await transaction
        .select({ quantity: farmInventory.quantity })
        .from(farmInventory)
        .where(
          and(
            eq(farmInventory.farmId, farm.id),
            eq(farmInventory.itemKey, "barley")
          )
        )
        .limit(1)
    )[0]?.quantity ?? 0;
    const granaries = await transaction
      .select({
        id: farmBuildings.id,
        storedBarley: farmBuildings.storedBarley
      })
      .from(farmBuildings)
      .where(
        and(
          eq(farmBuildings.farmId, farm.id),
          eq(farmBuildings.type, "granary"),
          lte(farmBuildings.completesAt, now)
        )
      )
      .orderBy(asc(farmBuildings.completesAt), asc(farmBuildings.id));

    let remaining = dueRations;
    remaining -= await consumeFarmBarley(
      transaction,
      farm.id,
      farmBarley,
      remaining
    );

    for (const granary of granaries) {
      const consumed = Math.min(granary.storedBarley, remaining);

      if (consumed > 0) {
        await transaction
          .update(farmBuildings)
          .set({
            storedBarley: sql`${farmBuildings.storedBarley} - ${consumed}`
          })
          .where(eq(farmBuildings.id, granary.id));
        remaining -= consumed;
      }

      if (remaining === 0) {
        break;
      }
    }

    const consumed = dueRations - remaining;
    consumedRations = consumed;

    if (remaining === 0) {
      hungrySince = null;
      nextBarleyConsumptionAt = new Date(
        farm.hungrySince === null && nextConsumptionAt !== null
          ? nextConsumptionAt.getTime() +
              dueRations * BARLEY_CONSUMPTION_INTERVAL_MS
          : now.getTime() + BARLEY_CONSUMPTION_INTERVAL_MS
      );
    } else {
      hungrySince ??= new Date(
        (nextConsumptionAt?.getTime() ?? now.getTime()) +
          consumed * BARLEY_CONSUMPTION_INTERVAL_MS
      );
      nextBarleyConsumptionAt = new Date(
        now.getTime() + BARLEY_CONSUMPTION_INTERVAL_MS
      );
    }
  }

  const wellbeing = advanceHappiness(
    { happiness: farm.happiness, checkedAt: farm.happinessCheckedAt.getTime() }, now.getTime(),
    farm.hungrySince === null ? nextConsumptionAt?.getTime() ?? now.getTime() : now.getTime(),
    consumedRations,
    hungrySince !== null && farm.hungrySince === null ? hungrySince.getTime() : null,
    farm.level
  );
  const happiness = wellbeing.happiness;
  const farmChanged =
    wellbeing.checkedAt !== farm.happinessCheckedAt.getTime() ||
    happiness !== farm.happiness ||
    carriedBarleyExpired ||
    hungrySince?.getTime() !== farm.hungrySince?.getTime() ||
    nextBarleyConsumptionAt?.getTime() !==
      farm.nextBarleyConsumptionAt?.getTime();

  if (!farmChanged) {
    return farm;
  }

  const [updatedFarm] = await transaction
    .update(farms)
    .set({
      carriedItemKey: carriedBarleyExpired ? null : farm.carriedItemKey,
      carriedItemQuantity: carriedBarleyExpired
        ? 0
        : farm.carriedItemQuantity,
      carriedItemExpiresAt: carriedBarleyExpired
        ? null
        : farm.carriedItemExpiresAt,
      hungrySince,
      happiness,
      happinessCheckedAt: new Date(wellbeing.checkedAt),
      nextBarleyConsumptionAt
    })
    .where(eq(farms.id, farm.id))
    .returning();

  return updatedFarm ?? farm;
};
