import { porterPath, type PorterBuilding } from "./porter";
import type { FarmRoad } from "../../game-data/roads";
import type { FarmCoordinate } from "./irrigation";
import { FARMER_MOVE_DURATION_PER_TILE } from "./batchPlantingTravel";
import { farmerMovementDurationMultiplier } from "./wellbeing";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { FARM_STORAGE_CAPACITY } from "../../game-data/storage";

/** Schedule the second leg only when surplus and farm space both exist. */
export const harvestFarmDeliveryPlan = (input: {
  buildings: readonly PorterBuilding[]; roads: readonly FarmRoad[]; from: FarmCoordinate;
  at: number; happiness: number; hungry: boolean; level: number; quantity: number; farmQuantity: number;
}) => {
  if (input.quantity <= 0 || input.farmQuantity >= FARM_STORAGE_CAPACITY) return null;
  const path = porterPath(input.buildings, input.roads, input.from, INITIAL_FARM_CONFIG.farmerSpawn, input.at);
  if (!path) return null;
  const duration = Math.ceil((path.length - 1) * FARMER_MOVE_DURATION_PER_TILE * farmerMovementDurationMultiplier(input.happiness, input.hungry, input.level));
  return { type: "delivering" as const, granaryId: null, path: [...path], startedAt: new Date(input.at).toISOString(), completesAt: new Date(input.at + duration).toISOString() };
};

/** Shared route/timing only. Storage settlement remains server-authoritative. */
export const harvestDeliveryPlan = (input: {
  buildings: readonly PorterBuilding[]; roads: readonly FarmRoad[];
  from: FarmCoordinate; at: number; happiness: number; hungry: boolean; level: number;
}) => {
  for (const granary of input.buildings.filter(b => b.type === "granary" && b.completesAt <= input.at).sort((a, b) => a.id.localeCompare(b.id))) {
    const target = granary.loadingTile ?? { column: granary.column, row: granary.row + 2 };
    const path = porterPath(input.buildings, input.roads, input.from, target, input.at);
    if (!path) continue;
    const duration = Math.ceil((path.length - 1) * FARMER_MOVE_DURATION_PER_TILE * farmerMovementDurationMultiplier(input.happiness, input.hungry, input.level));
    return { type: "delivering" as const, granaryId: granary.id, path: [...path], startedAt: new Date(input.at).toISOString(), completesAt: new Date(input.at + duration).toISOString() };
  }
  return null;
};
