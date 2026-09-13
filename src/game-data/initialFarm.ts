import type { FarmObjectType } from "./farmObjects";
import type { InventoryItemKey } from "./inventoryItems";

export const INITIAL_FARM_CONFIG = {
  worldBounds: {
    minimumColumn: -4,
    maximumColumn: 11,
    minimumRow: 0,
    maximumRow: 15
  },
  plotBounds: {
    minimumColumn: 0,
    maximumColumn: 7,
    minimumRow: 0,
    maximumRow: 7
  },
  buildingBounds: {
    minimumColumn: 3,
    maximumColumn: 4,
    minimumRow: 0,
    maximumRow: 1
  },
  riverRow: 10,
  objectCount: {
    minimum: 2,
    maximum: 4
  },
  reedSourceCount: 2
} as const;

export const INITIAL_FARM_INVENTORY: readonly {
  readonly itemKey: InventoryItemKey;
  readonly quantity: number;
}[] = [];

export const INITIAL_FARM_GROUND_ITEMS = [
  { itemKey: "barley", quantity: 1, column: 2, row: 0 },
  { itemKey: "barley", quantity: 1, column: 2, row: 1 }
] as const satisfies readonly {
  readonly itemKey: InventoryItemKey;
  readonly quantity: number;
  readonly column: number;
  readonly row: number;
}[];

export type InitialFarmObject = {
  readonly type: FarmObjectType;
  readonly column: number;
  readonly row: number;
};

export type InitialFarmPlan = {
  readonly inventory: typeof INITIAL_FARM_INVENTORY;
  readonly groundItems: typeof INITIAL_FARM_GROUND_ITEMS;
  readonly objects: readonly InitialFarmObject[];
};
