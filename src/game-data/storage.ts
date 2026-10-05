import { FARM_BUILDING_DEFINITIONS, type FarmBuildingType } from "./buildings";
import type { InventoryItemKey } from "./inventoryItems";

export const ESTATE_STORAGE_LIMITS = {
  bread: 10, beer: 10, flour: 10, brewersGroats: 10, reed: 6, clay: 6
} as const;
export const WAREHOUSE_RESOURCE_BONUS = 10;
export const estateResourceCapacity = (
  item: InventoryItemKey,
  buildings: readonly { readonly type: FarmBuildingType; readonly completesAt: string | Date }[],
  now: number
): number => {
  if (item === "donkey") return 1;
  if (item === "fish") return 5;
  if (!(item in ESTATE_STORAGE_LIMITS)) return 2147483647;
  const base = ESTATE_STORAGE_LIMITS[item as keyof typeof ESTATE_STORAGE_LIMITS];
  return base + (buildings.some(b => b.type === "warehouse" && new Date(b.completesAt).getTime() <= now) ? WAREHOUSE_RESOURCE_BONUS : 0);
};

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
