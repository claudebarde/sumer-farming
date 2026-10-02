import { FARM_BUILDING_DEFINITIONS, type FarmBuildingType } from "./buildings";

export const FARM_STORAGE_CAPACITY = 5;
export const FARMER_CARRY_CAPACITY = 2;
export const UPGRADED_GRANARY_CAPACITY = 20;
export const granaryCapacityForLevel = (level: number): number =>
  level >= 7 ? UPGRADED_GRANARY_CAPACITY : FARM_BUILDING_DEFINITIONS.granary.barleyStorageBonus;

export const calculateFarmStorageCapacity = (
  buildings: readonly {
    readonly type: FarmBuildingType;
    readonly completesAt: string | Date;
  }[],
  currentTime: number,
  level = 1
): number =>
  buildings.reduce(
    (capacity, building) =>
      new Date(building.completesAt).getTime() <= currentTime
        ? capacity +
          (building.type === "granary" ? granaryCapacityForLevel(level) : FARM_BUILDING_DEFINITIONS[building.type].barleyStorageBonus)
        : capacity,
    FARM_STORAGE_CAPACITY
  );
