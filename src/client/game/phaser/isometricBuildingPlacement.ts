import type { FarmSnapshot } from "../../../schemas/farm";
import { getBuildingFootprint, validateBuildingPlacement, type BuildingPlacementRule } from "../../../game-core/farm/buildings";
import { preservesBuildingAccess } from "../../../game-core/farm/buildingAccess";
import { findLoadingTile } from "../../../game-core/farm/roads";
import { FARM_BUILDING_DEFINITIONS } from "../../../game-data/buildings";
import { farmOrigin, presentCanals } from "./isometricFarm";
import type { IsoCell } from "./isometricProjection";
import { granaryLimitForLevel } from "../../../game-data/progression";
import { plantingBlocker } from "./isometricPlanting";

export type PlaceableBuilding = "granary" | "mill";
export const buildingBuildBlocker = (snapshot: FarmSnapshot, now: number, type: PlaceableBuilding): string | null => {
  const unlock = type === "granary" ? 2 : 5;
  if ((snapshot.farm.progression?.level ?? 1) < unlock) return `Unlock at level ${unlock}`;
  if (snapshot.buildings.filter(b => b.type === type).length >= (type === "granary" ? granaryLimitForLevel(snapshot.farm.progression?.level ?? 1) : 1)) return "Already built";
  if (snapshot.farm.carriedItem) return "Empty the farmer’s hands first.";
  const busy = plantingBlocker(snapshot, now);
  if (busy) return busy;
  for (const [key, required] of Object.entries(FARM_BUILDING_DEFINITIONS[type].materials)) {
    const available = [...snapshot.inventory, ...snapshot.groundItems].filter(i => i.itemKey === key).reduce((sum, i) => sum + i.quantity, 0);
    if (available < required) return `Gather 2 reed and ${FARM_BUILDING_DEFINITIONS[type].materials.clay} clay.`;
  }
  return null;
};

/** Spatial-only mock: never spends materials or writes a building. Existing
 * buildings still occupy space, but ownership/cost/level gates are bypassed. */
export const mockGranaryPlacement = (snapshot: FarmSnapshot, target: IsoCell, farmer: IsoCell, now: number, real = false, type: PlaceableBuilding = "granary") => {
  const footprint = getBuildingFootprint(type, target);
  const occupied = new Set([
    ...getBuildingFootprint("granary", farmOrigin),
    ...snapshot.buildings.flatMap(b => getBuildingFootprint(b.type, b)),
    ...snapshot.objects, ...snapshot.crops, ...snapshot.groundItems,
    ...presentCanals(snapshot, now),
    { column: Math.round(farmer.column), row: Math.round(farmer.row) }
  ].map(p => `${p.column}:${p.row}`));
  const reserved = snapshot.buildings.flatMap(b => b.loadingTile ? [b.loadingTile] : []);
  const validation = validateBuildingPlacement({ building: type, target,
    existingBuildings: real ? snapshot.buildings : [], granaryLimit: real ? granaryLimitForLevel(snapshot.farm.progression?.level ?? 1) : undefined,
    occupiedCoordinates: occupied, carriedItem: real ? snapshot.farm.carriedItem?.itemKey ?? null : null,
    availableMaterials: real ? {
      reed: [...snapshot.inventory, ...snapshot.groundItems].filter(i => i.itemKey === "reed").reduce((sum, i) => sum + i.quantity, 0),
      clay: [...snapshot.inventory, ...snapshot.groundItems].filter(i => i.itemKey === "clay").reduce((sum, i) => sum + i.quantity, 0)
    } : FARM_BUILDING_DEFINITIONS[type].materials,
    roads: snapshot.farm.roads, reservedLoadingTiles: reserved });
  const rule: BuildingPlacementRule = validation.type === "valid" &&
    !preservesBuildingAccess({ buildings: [...snapshot.buildings, { ...target, type }] })
    ? { type: "access_blocked" } : validation;
  return { footprint, rule, loading: rule.type === "valid"
    ? findLoadingTile(footprint, snapshot.farm.roads, reserved, occupied) : null };
};

export const granaryPlacement = (snapshot: FarmSnapshot, target: IsoCell, farmer: IsoCell, now: number) =>
  mockGranaryPlacement(snapshot, target, farmer, now, true);

export const granaryBuildBlocker = (snapshot: FarmSnapshot, now: number) => buildingBuildBlocker(snapshot, now, "granary");
export const buildingPlacement = (snapshot: FarmSnapshot, target: IsoCell, farmer: IsoCell, now: number, type: PlaceableBuilding) =>
  mockGranaryPlacement(snapshot, target, farmer, now, true, type);
