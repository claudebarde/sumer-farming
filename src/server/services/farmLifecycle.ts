import { and, asc, eq, lte, sql, inArray } from "drizzle-orm";
import { getRiverConnectedCanals } from "../../game-core/farm/irrigation";
import { migrateFarmLand } from "./farmLandMigration";
import { initializePhysicalStorage } from "./physicalStorage";

import { BARLEY_CONSUMPTION_INTERVAL_MS } from "../../game-data/household";
import { BEER_RECIPE, BREWERY_EMPTY_JAR_CAPACITY } from "../../game-data/brewing";
import { FARM_BUILDING_DEFINITIONS } from "../../game-data/buildings";
import { advancePorterLifecycle } from "./porterLifecycle";
import { advanceHappiness } from "../../game-core/farm/wellbeing";
import { advanceBatchPlanting } from "./batchPlantingLifecycle";
import { advancePerennialCropWork } from "./perennialCropLifecycle";
import type { DatabaseTransaction } from "../db/client";
import {
  farmBuildings,
  farmCrops,
  farmImprovements,
  farmGroundItems,
  farmInventory,
  shekelTransactions,
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
  farm = await migrateFarmLand(transaction, farm, now);
  await initializePhysicalStorage(transaction, farm.id, now);
  // Return legacy overstock to free inventory; preserve the estate's total jars.
  const jarStores = await transaction.select().from(farmBuildings)
    .where(and(eq(farmBuildings.farmId, farm.id), eq(farmBuildings.type, "brewery"))).for("update");
  const excessJars = jarStores.reduce((total, b) => total + Math.max(0, b.emptyBeerJars - BREWERY_EMPTY_JAR_CAPACITY), 0);
  if (excessJars > 0) {
    for (const building of jarStores.filter(b => b.emptyBeerJars > BREWERY_EMPTY_JAR_CAPACITY)) {
      await transaction.update(farmBuildings).set({ emptyBeerJars: BREWERY_EMPTY_JAR_CAPACITY }).where(eq(farmBuildings.id, building.id));
    }
    await transaction.insert(farmInventory).values({ farmId: farm.id, itemKey: "emptyBeerJar", quantity: excessJars, updatedAt: now })
      .onConflictDoUpdate({ target: [farmInventory.farmId, farmInventory.itemKey],
        set: { quantity: sql`${farmInventory.quantity} + ${excessJars}`, updatedAt: now } });
  }
  // Restore equipment consumed by legacy construction, including unfinished sites.
  // Reconciliation is idempotent: never add to an already-owned set.
  const equippedBuildings = await transaction.select({ type: farmBuildings.type }).from(farmBuildings)
    .where(and(eq(farmBuildings.farmId, farm.id), inArray(farmBuildings.type, ["brewery", "breadOven"])));
  for (const [building, itemKey, quantity] of [
    ["brewery", "brewingVessels", FARM_BUILDING_DEFINITIONS.brewery.materials.brewingVessels],
    ["breadOven", "bakingTools", FARM_BUILDING_DEFINITIONS.breadOven.materials.bakingTools]
  ] as const) {
    if (!equippedBuildings.some(entry => entry.type === building)) continue;
    await transaction.insert(farmInventory).values({ farmId: farm.id, itemKey, quantity, updatedAt: now })
      .onConflictDoUpdate({ target: [farmInventory.farmId, farmInventory.itemKey],
        set: { quantity, updatedAt: now }, setWhere: sql`${farmInventory.quantity} < ${quantity}` });
  }
  const roads = farm.roads.filter(road => !road.removing || (road.completesAt ?? 0) > now.getTime());
  if (roads.length !== farm.roads.length) {
    const [updated] = await transaction.update(farms).set({ roads, updatedAt: now })
      .where(eq(farms.id, farm.id)).returning();
    farm = updated ?? farm;
  }
  // Gathering completes from saved time, including while the tab is closed.
  // Leave the material in the farmer's hands for a player-directed drop/deposit.
  if (farm.gatheringItemKey && farm.gatheringCompletesAt && farm.gatheringCompletesAt <= now && !farm.carriedItemKey) {
    const [gathered] = await transaction.update(farms).set({
      carriedItemKey: farm.gatheringItemKey, carriedItemQuantity: 1, carriedItemExpiresAt: null,
      gatheringItemKey: null, gatheringColumn: null, gatheringRow: null,
      gatheringStartedAt: null, gatheringCompletesAt: null,
      production: { ...farm.production, materialDelivery: false, materialReservation: null },
      updatedAt: now
    }).where(eq(farms.id, farm.id)).returning();
    farm = gathered ?? farm;
  }
  // Upgrade legacy second granaries in place: preserve coordinates, construction
  // timestamps, loading tile and stored barley. No goods are discarded.
  const storageBuildings = await transaction.select().from(farmBuildings)
    .where(and(eq(farmBuildings.farmId, farm.id), inArray(farmBuildings.type, ["granary", "warehouse"])))
    .orderBy(asc(farmBuildings.startedAt), asc(farmBuildings.id));
  if (!storageBuildings.some(b => b.type === "warehouse")) {
    const secondGranary = storageBuildings.filter(b => b.type === "granary")[1];
    if (secondGranary) await transaction.update(farmBuildings).set({ type: "warehouse" }).where(eq(farmBuildings.id, secondGranary.id));
  }
  // Legacy level-3 saves have no entry history. Start once, before advancing work.
  if (farm.level === 3 && !farm.progressionStats.level3Baseline) {
    const progressionStats = { ...farm.progressionStats,
      level3Baseline: { harvests: farm.progressionStats.harvests }
    };
    await transaction.update(farms).set({ progressionStats }).where(eq(farms.id, farm.id));
    farm = { ...farm, progressionStats };
  }
  // Older level-5 saves lack an entry count. Initialize once under the farm lock,
  // before new work completes; preserve lifetime totals and existing baselines.
  if (farm.level === 5 && !farm.progressionStats.level5Baseline) {
    const progressionStats = { ...farm.progressionStats,
      level5Baseline: { harvests: farm.progressionStats.harvests }
    };
    await transaction.update(farms).set({ progressionStats }).where(eq(farms.id, farm.id));
    farm = { ...farm, progressionStats };
  }
  if (farm.level === 8 && farm.progressionStats.level8Baseline?.produced === undefined) {
    const progressionStats = { ...farm.progressionStats,
      level8Baseline: {
        harvestedBarley: farm.progressionStats.level8Baseline?.harvestedBarley ?? farm.progressionStats.harvestedBarley,
        produced: farm.progressionStats.beerProduced + (farm.progressionStats.breadProduced ?? 0)
      } };
    await transaction.update(farms).set({ progressionStats }).where(eq(farms.id, farm.id));
    farm = { ...farm, progressionStats };
  }
  if (farm.level === 9 && !farm.progressionStats.level9Baseline) {
    const progressionStats = { ...farm.progressionStats, level9Baseline: {
      produced: farm.progressionStats.beerProduced + (farm.progressionStats.breadProduced ?? 0),
      datesStored: farm.progressionStats.datesStored ?? 0
    } };
    await transaction.update(farms).set({ progressionStats }).where(eq(farms.id, farm.id));
    farm = { ...farm, progressionStats };
  }
  farm = await advanceBatchPlanting(transaction, farm, now);
  farm = await advancePerennialCropWork(transaction, farm, now);
  if (!farm.progressionStats.builtFirstCanal || !farm.progressionStats.plantedFirstBarley) {
    const planted = await transaction.select({ id: farmCrops.id }).from(farmCrops)
      .where(and(eq(farmCrops.farmId, farm.id), eq(farmCrops.cropKey, "barley"), lte(farmCrops.plantedAt, now))).limit(1);
    const canals = await transaction.select().from(farmImprovements)
      .where(and(eq(farmImprovements.farmId, farm.id), eq(farmImprovements.type, "irrigation"), lte(farmImprovements.completesAt, now)));
    const plantedFirstBarley = farm.progressionStats.plantedFirstBarley === true || planted.length > 0 ||
      farm.progressionStats.harvests > 0 || farm.progressionStats.harvestedBarley > 0;
    const builtFirstCanal = farm.progressionStats.builtFirstCanal === true || plantedFirstBarley || getRiverConnectedCanals(canals).length > 0;
    if (builtFirstCanal !== (farm.progressionStats.builtFirstCanal === true) ||
      plantedFirstBarley !== (farm.progressionStats.plantedFirstBarley === true)) {
      const progressionStats = { ...farm.progressionStats, builtFirstCanal, plantedFirstBarley };
      await transaction.update(farms).set({ progressionStats }).where(eq(farms.id, farm.id));
      farm = { ...farm, progressionStats };
    }
  }
  // Old saves lack a level-entry baseline. Start tracking once, under the farm
  // row lock, before processing newly completed jobs or actions.
  if (farm.level === 6 && !farm.progressionStats.level6Baseline) {
    const [sales] = await transaction.select({ quantity: sql<number>`coalesce(sum(${shekelTransactions.itemQuantity}), 0)::int` })
      .from(shekelTransactions).where(and(eq(shekelTransactions.playerId, farm.playerId),
        eq(shekelTransactions.type, "market_sale"), sql`${shekelTransactions.itemKey} in ('bread', 'beer')`));
    const progressionStats = { ...farm.progressionStats, level6Baseline: {
      produced: farm.progressionStats.beerProduced + (farm.progressionStats.breadProduced ?? 0),
      sold: sales?.quantity ?? 0
    } };
    await transaction.update(farms).set({ progressionStats }).where(eq(farms.id, farm.id));
    farm = { ...farm, progressionStats };
  }
  const readyBreweries = await transaction.select().from(farmBuildings).where(and(
    eq(farmBuildings.farmId, farm.id), eq(farmBuildings.type, "brewery"), lte(farmBuildings.beerReadyAt, now)
  ));
  const readyBakes = Object.entries(farm.production.baking).filter(([, job]) => Date.parse(job.completesAt) <= now.getTime());
  const porterReadyAt = Object.fromEntries([
    ...readyBreweries.map(b => [b.id, b.beerReadyAt!.getTime()] as const),
    ...readyBakes.map(([id, job]) => [id, Date.parse(job.completesAt)] as const),
    ...(farm.milling && Date.parse(farm.milling.completesAt) <= now.getTime() ? [[farm.milling.buildingId, Date.parse(farm.milling.completesAt)] as const] : [])
  ]);
  if (readyBreweries.length > 0 || readyBakes.length > 0) {
    const pending = { ...farm.production.pending };
    let beerProduced = 0;
    for (const brewery of readyBreweries) {
      const quantity = Math.max(0, BEER_RECIPE.output - brewery.beerServed);
      if (quantity > 0) pending[brewery.id] = { itemKey: "beer", quantity: (pending[brewery.id]?.quantity ?? 0) + quantity };
      beerProduced += quantity;
      await transaction.update(farmBuildings).set({ beerReadyAt: null, beerServed: 0 }).where(eq(farmBuildings.id, brewery.id));
    }
    for (const [id, job] of readyBakes) pending[id] = { itemKey: "bread", quantity: (pending[id]?.quantity ?? 0) + job.output };
    const [updated] = await transaction.update(farms).set({
      production: { ...farm.production, pending, brewing: Object.fromEntries(Object.entries(farm.production.brewing ?? {}).filter(([id]) => !readyBreweries.some(b => b.id === id))), baking: Object.fromEntries(Object.entries(farm.production.baking).filter(([, job]) => Date.parse(job.completesAt) > now.getTime())) },
      progressionStats: { ...farm.progressionStats, beerProduced: farm.progressionStats.beerProduced + beerProduced,
        breadProduced: (farm.progressionStats.breadProduced ?? 0) + readyBakes.reduce((sum, [, job]) => sum + job.output, 0) },
      version: sql`${farms.version} + 1`, updatedAt: now
    }).where(eq(farms.id, farm.id)).returning();
    farm = updated!;
  }
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
  farm = await advancePorterLifecycle(transaction, farm, now, porterReadyAt);
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
          inArray(farmBuildings.type, ["granary", "warehouse"]),
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
    farm.level,
    farm.production.shrineBlessing
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
