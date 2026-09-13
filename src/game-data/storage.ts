import { FARM_BUILDING_DEFINITIONS, type FarmBuildingType } from "./buildings";

export const FARM_STORAGE_CAPACITY = 5;
export const FARMER_CARRY_CAPACITY = 2;

export const calculateFarmStorageCapacity = (
  buildings: readonly {
    readonly type: FarmBuildingType;
    readonly completesAt: string | Date;
  }[],
  currentTime: number
): number =>
  buildings.reduce(
    (capacity, building) =>
      new Date(building.completesAt).getTime() <= currentTime
        ? capacity +
          FARM_BUILDING_DEFINITIONS[building.type].barleyStorageBonus
        : capacity,
    FARM_STORAGE_CAPACITY
  );
