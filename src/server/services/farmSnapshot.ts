import { asc, eq } from "drizzle-orm";

import type { FarmSnapshot } from "../../schemas/farm";
import type { DatabaseTransaction } from "../db/client";
import {
  farmCrops,
  farmBuildings,
  farmGroundItems,
  farmImprovements,
  farmInventory,
  farmObjects,
  farms,
  players
} from "../db/schema";
import { removeCompletedImprovementDestructions } from "./farmImprovementLifecycle";
import { advanceFarmLifecycle } from "./farmLifecycle";

type FarmRecord = typeof farms.$inferSelect;

export const readFarmSnapshot = async (
  transaction: DatabaseTransaction,
  farm: FarmRecord,
  created: boolean
): Promise<FarmSnapshot> => {
  const currentFarm = await advanceFarmLifecycle(
    transaction,
    farm,
    new Date()
  );
  await removeCompletedImprovementDestructions(
    transaction,
    currentFarm.id,
    new Date()
  );

  const [player] = await transaction
    .select({ shekelBalance: players.shekelBalance })
    .from(players)
    .where(eq(players.id, currentFarm.playerId))
    .limit(1);

  if (player === undefined) {
    throw new Error("The farm owner could not be found");
  }

  const inventory = await transaction
    .select({
      itemKey: farmInventory.itemKey,
      quantity: farmInventory.quantity
    })
    .from(farmInventory)
    .where(eq(farmInventory.farmId, currentFarm.id))
    .orderBy(asc(farmInventory.itemKey));
  const objects = await transaction
    .select({
      id: farmObjects.id,
      type: farmObjects.type,
      column: farmObjects.column,
      row: farmObjects.row
    })
    .from(farmObjects)
    .where(eq(farmObjects.farmId, currentFarm.id))
    .orderBy(asc(farmObjects.row), asc(farmObjects.column));
  const groundItems = await transaction
    .select({
      id: farmGroundItems.id,
      itemKey: farmGroundItems.itemKey,
      quantity: farmGroundItems.quantity,
      column: farmGroundItems.column,
      row: farmGroundItems.row,
      expiresAt: farmGroundItems.expiresAt
    })
    .from(farmGroundItems)
    .where(eq(farmGroundItems.farmId, currentFarm.id))
    .orderBy(asc(farmGroundItems.row), asc(farmGroundItems.column));
  const crops = await transaction
    .select({
      id: farmCrops.id,
      cropKey: farmCrops.cropKey,
      column: farmCrops.column,
      row: farmCrops.row,
      sowingStartedAt: farmCrops.sowingStartedAt,
      plantedAt: farmCrops.plantedAt,
      growthCompletesAt: farmCrops.growthCompletesAt,
      harvestStartedAt: farmCrops.harvestStartedAt,
      harvestCompletesAt: farmCrops.harvestCompletesAt
    })
    .from(farmCrops)
    .where(eq(farmCrops.farmId, currentFarm.id))
    .orderBy(asc(farmCrops.row), asc(farmCrops.column));
  const improvements = await transaction
    .select({
      id: farmImprovements.id,
      type: farmImprovements.type,
      column: farmImprovements.column,
      row: farmImprovements.row,
      startedAt: farmImprovements.startedAt,
      completesAt: farmImprovements.completesAt,
      destroyStartedAt: farmImprovements.destroyStartedAt,
      destroyCompletesAt: farmImprovements.destroyCompletesAt
    })
    .from(farmImprovements)
    .where(eq(farmImprovements.farmId, currentFarm.id))
    .orderBy(asc(farmImprovements.row), asc(farmImprovements.column));
  const buildings = await transaction
    .select({
      id: farmBuildings.id,
      type: farmBuildings.type,
      column: farmBuildings.column,
      row: farmBuildings.row,
      storedBarley: farmBuildings.storedBarley,
      brewingBarley: farmBuildings.brewingBarley,
      brewingWater: farmBuildings.brewingWater,
      emptyBeerJars: farmBuildings.emptyBeerJars,
      beerReadyAt: farmBuildings.beerReadyAt,
      beerServed: farmBuildings.beerServed,
      startedAt: farmBuildings.startedAt,
      completesAt: farmBuildings.completesAt
    })
    .from(farmBuildings)
    .where(eq(farmBuildings.farmId, currentFarm.id))
    .orderBy(asc(farmBuildings.row), asc(farmBuildings.column));

  return {
    created,
    player,
    farm: {
      id: currentFarm.id,
      playerId: currentFarm.playerId,
      version: currentFarm.version,
      household: {
        cultivationStartedAt:
          currentFarm.cultivationStartedAt?.toISOString() ?? null,
        nextBarleyConsumptionAt:
          currentFarm.nextBarleyConsumptionAt?.toISOString() ?? null,
        hungrySince: currentFarm.hungrySince?.toISOString() ?? null,
        happiness: currentFarm.happiness,
        lastBeerAt: currentFarm.lastBeerAt?.toISOString() ?? null
      },
      fishing: currentFarm.fishing === null ? null : { ...currentFarm.fishing, serverNow: Date.now() },
      carriedItem:
        currentFarm.carriedItemKey === null
          ? null
          : {
              itemKey: currentFarm.carriedItemKey,
              quantity: currentFarm.carriedItemQuantity,
              expiresAt:
                currentFarm.carriedItemExpiresAt?.toISOString() ?? null
            },
      gathering:
        currentFarm.gatheringItemKey === null ||
        currentFarm.gatheringColumn === null ||
        currentFarm.gatheringRow === null ||
        currentFarm.gatheringStartedAt === null ||
        currentFarm.gatheringCompletesAt === null
          ? null
          : {
              itemKey: currentFarm.gatheringItemKey,
              target: {
                column: currentFarm.gatheringColumn,
                row: currentFarm.gatheringRow
              },
              startedAt: currentFarm.gatheringStartedAt.toISOString(),
              completesAt: currentFarm.gatheringCompletesAt.toISOString()
            }
    },
    inventory,
    objects,
    groundItems: groundItems.map(item => ({
      ...item,
      expiresAt: item.expiresAt?.toISOString() ?? null
    })),
    crops: crops.map(crop => ({
      ...crop,
      sowingStartedAt: crop.sowingStartedAt.toISOString(),
      plantedAt: crop.plantedAt.toISOString(),
      growthCompletesAt: crop.growthCompletesAt.toISOString(),
      harvestStartedAt: crop.harvestStartedAt?.toISOString() ?? null,
      harvestCompletesAt: crop.harvestCompletesAt?.toISOString() ?? null
    })),
    improvements: improvements.map(improvement => ({
      ...improvement,
      startedAt: improvement.startedAt.toISOString(),
      completesAt: improvement.completesAt.toISOString(),
      destroyStartedAt: improvement.destroyStartedAt?.toISOString() ?? null,
      destroyCompletesAt:
        improvement.destroyCompletesAt?.toISOString() ?? null
    })),
    buildings: buildings.map(building => ({
      ...building,
      beerReadyAt: building.beerReadyAt?.toISOString() ?? null,
      startedAt: building.startedAt.toISOString(),
      completesAt: building.completesAt.toISOString()
    }))
  };
};
