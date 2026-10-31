import type { FarmSnapshot } from "../../../schemas/farm";
import { storedLocations } from "../../../game-core/farm/physicalStorage";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { ACTION_POINTS } from "../../../game-data/points";
import type { HarvestGain } from "./isometricHarvesting";

/** Keeping a caught fish is the only scored storage action. Production and
 * crop points belong to completion, never to farmer/porter delivery or splits. */
export const deliveryGains = (before: FarmSnapshot, after: FarmSnapshot, now: number,
  farmerDepositAt = now): readonly HarvestGain[] => {
  if (before.farm.id !== after.farm.id || after.farm.version <= before.farm.version ||
    before.farm.carriedItem?.itemKey !== "fish" || after.farm.carriedItem?.itemKey === "fish" ||
    (after.player.points ?? 0) - (before.player.points ?? 0) < ACTION_POINTS.keepFish) return [];
  const oldLocations = storedLocations(before.inventory.find(i => i.itemKey === "fish"), before.buildings, now);
  const locations = storedLocations(after.inventory.find(i => i.itemKey === "fish"), after.buildings, now);
  const destination = Object.entries(locations).find(([location, quantity]) => quantity > (oldLocations[location] ?? 0))?.[0];
  if (!destination) return []; // Releasing the fish does not earn points.
  const building = after.buildings.find(b => b.id === destination);
  if (destination !== "farm" && !building) return [];
  const cell = building?.loadingTile ?? (building ? { column: building.column, row: building.row + 2 }
    : INITIAL_FARM_CONFIG.farmerSpawn);
  return [{ cell, at: Math.max(now, farmerDepositAt), quantity: ACTION_POINTS.keepFish }];
};
