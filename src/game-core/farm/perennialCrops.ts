import type { FarmSnapshot } from "../../schemas/farm";
import { CROP_DEFINITIONS, type PerennialCropKey } from "../../game-data/crops";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../game-data/movement";
import { estateResourceCapacity } from "../../game-data/storage";
import { plantableFields } from "./batchPlanting";
import { porterPath } from "./porter";
import { sharedDeliveryStop } from "./storageDelivery";
import { farmerMovementDurationMultiplier } from "./wellbeing";
import type { FarmCoordinate } from "./irrigation";

export const cropWorkActive = (snapshot: FarmSnapshot) => !!snapshot.farm.production.cropWork && !snapshot.farm.production.cropWork.settled;

export const perennialActionReason = (snapshot: FarmSnapshot, cropKey: PerennialCropKey, target: FarmCoordinate, action: "plant" | "harvest", now: number): string | null => {
  const definition = CROP_DEFINITIONS[cropKey];
  if ((snapshot.farm.progression?.level ?? 1) < definition.unlockLevel) return `Unlocks at level ${definition.unlockLevel}`;
  if (snapshot.farm.carriedItem) return "Empty your hands first";
  if (cropWorkActive(snapshot)) return "The farmer is busy";
  if (action === "plant") {
    if (snapshot.crops.filter(c => c.cropKey === cropKey).length >= definition.maximumPlants) return `Maximum ${definition.maximumPlants} palms`;
    if (!plantableFields(snapshot, now).some(p => p.column === target.column && p.row === target.row)) return "Plant on empty irrigated arable ground";
    if (snapshot.player.shekelBalance < definition.saplingCost) return `Requires ${definition.saplingCost} shekels`;
  } else {
    const crop = snapshot.crops.find(c => c.cropKey === cropKey && c.column === target.column && c.row === target.row);
    if (!crop) return "Crop not found";
    if (Date.parse(crop.growthCompletesAt) > now) return "Dates are still growing";
    const quantity = snapshot.inventory.find(i => i.itemKey === definition.harvestItemKey)?.quantity ?? 0;
    if (estateResourceCapacity(definition.harvestItemKey, snapshot.buildings, now) - quantity < definition.harvestYield) return "No storage space";
  }
  return null;
};

/** Choose a reachable adjacent work tile, then a warehouse-first delivery route. */
export const planCropWork = (snapshot: FarmSnapshot, target: FarmCoordinate, cropKey: PerennialCropKey, action: "plant" | "harvest", now: number, hint?: FarmCoordinate) => {
  const definition = CROP_DEFINITIONS[cropKey];
  const buildings = snapshot.buildings.map(b => ({ ...b, completesAt: Date.parse(b.completesAt) }));
  const home = INITIAL_FARM_CONFIG.farmerSpawn;
  const path = (from: FarmCoordinate, to: FarmCoordinate) => porterPath(buildings, snapshot.farm.roads, from, to, now);
  const start = hint && path(home, hint) ? hint : home;
  const candidates = [{ column: target.column, row: target.row + 1 }, { column: target.column - 1, row: target.row }, { column: target.column + 1, row: target.row }, { column: target.column, row: target.row - 1 }];
  const outbound = candidates.map(p => path(start, p)).filter(p => p !== null).sort((a, b) => a.length - b.length)[0];
  if (!outbound) return null;
  const workTile = outbound.at(-1)!;
  const warehouse = buildings.find(b => b.type === "warehouse" && b.completesAt <= now);
  const stored = snapshot.inventory.find(i => i.itemKey === definition.harvestItemKey)?.quantity ?? 0;
  const stop = sharedDeliveryStop(definition.harvestItemKey, stored, !!warehouse);
  if (action === "harvest" && (stop.room < definition.harvestYield || (stop.location === "warehouse" && !warehouse))) return null;
  const destinations = stop.location === "warehouse" && warehouse
    ? [warehouse.loadingTile, { column: warehouse.column, row: warehouse.row + 2 }, { column: warehouse.column - 1, row: warehouse.row }, { column: warehouse.column + 2, row: warehouse.row }, { column: warehouse.column, row: warehouse.row - 1 }].filter(p => p !== null)
    : [home];
  const inbound = action === "plant" ? [workTile] : destinations.map(p => path(workTile, p)).find(p => p !== null);
  if (!inbound) return null;
  const step = WORKER_MOVE_DURATION_PER_TILE * farmerMovementDurationMultiplier(snapshot.farm.household.happiness, snapshot.farm.household.hungrySince !== null, snapshot.farm.progression?.level ?? 1);
  const workStartsAt = now + Math.ceil((outbound.length - 1) * step);
  const workEndsAt = workStartsAt + (action === "plant" ? definition.sowingDurationMs : definition.harvestDurationMs);
  return { outbound: [...outbound], inbound: [...inbound], startedAt: now, workStartsAt, workEndsAt,
    completesAt: workEndsAt + Math.ceil((inbound.length - 1) * step), room: stop.room };
};
