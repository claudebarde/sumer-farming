import { ESTATE_STORAGE_LIMITS, WAREHOUSE_RESOURCE_BONUS, WAREHOUSE_DATE_BASKET_CAPACITY } from "../../game-data/storage";

export type SharedStorageItem = keyof typeof ESTATE_STORAGE_LIMITS | "dates";

/** Display persisted physical stock; retain compatibility with older snapshots. */
export const sharedStorageAllocation = (item: SharedStorageItem, quantity: number, warehouseComplete: boolean, locations?: Readonly<Record<string, number>> | null, warehouseId?: string) => {
  if (locations) return {
    farm: { quantity: locations.farm ?? 0, capacity: item === "dates" ? 0 : ESTATE_STORAGE_LIMITS[item] },
    warehouse: { quantity: warehouseId ? locations[warehouseId] ?? 0 : Object.entries(locations).reduce((sum, [id, q]) => sum + (id === "farm" ? 0 : q), 0),
      capacity: warehouseComplete ? item === "dates" ? WAREHOUSE_DATE_BASKET_CAPACITY : WAREHOUSE_RESOURCE_BONUS : 0 }
  };
  // Preserve legacy over-cap stock; never silently discard it or assign it to the farm.
  if (item === "dates") return { farm: { quantity: 0, capacity: 0 }, warehouse: { quantity, capacity: warehouseComplete ? WAREHOUSE_DATE_BASKET_CAPACITY : 0 } };
  const farmCapacity = ESTATE_STORAGE_LIMITS[item];
  const farmQuantity = warehouseComplete ? Math.max(0, quantity - WAREHOUSE_RESOURCE_BONUS) : quantity;
  return {
    farm: { quantity: farmQuantity, capacity: farmCapacity },
    warehouse: { quantity: warehouseComplete ? Math.max(0, quantity - farmQuantity) : 0, capacity: warehouseComplete ? WAREHOUSE_RESOURCE_BONUS : 0 }
  };
};
