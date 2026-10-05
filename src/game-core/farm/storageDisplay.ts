import { ESTATE_STORAGE_LIMITS, WAREHOUSE_RESOURCE_BONUS } from "../../game-data/storage";

export type SharedStorageItem = keyof typeof ESTATE_STORAGE_LIMITS;

/** Shared goods fill warehouse capacity first. No separate transfer ledger is needed. */
export const sharedStorageAllocation = (item: SharedStorageItem, quantity: number, warehouseComplete: boolean) => {
  const farmCapacity = ESTATE_STORAGE_LIMITS[item];
  const farmQuantity = warehouseComplete ? Math.max(0, quantity - WAREHOUSE_RESOURCE_BONUS) : quantity;
  return {
    farm: { quantity: farmQuantity, capacity: farmCapacity },
    warehouse: { quantity: warehouseComplete ? Math.max(0, quantity - farmQuantity) : 0, capacity: warehouseComplete ? WAREHOUSE_RESOURCE_BONUS : 0 }
  };
};
