import { z } from "zod";

import type { InventoryItemKey } from "./inventoryItems";

export const farmBuildingTypes = ["granary", "brewery", "mill", "breadOven"] as const;

export const FarmBuildingTypeSchema = z.enum(farmBuildingTypes);

export type FarmBuildingType = z.infer<typeof FarmBuildingTypeSchema>;

// Estate-level caps; future progression can supply higher limits here.
export const FARM_BUILDING_LIMITS: Readonly<Partial<Record<FarmBuildingType, number>>> = { granary: 2 };

// Shared construction balance for both level-6 processing buildings.
const PROCESSING_BUILDING_CONSTRUCTION = {
  footprint: { columns: 2, rows: 2 },
  constructionDurationMs: 3 * 60 * 1_000,
  barleyStorageBonus: 0,
  materials: { reed: 4, clay: 6, brewingVessels: 2 }
} as const;

export const BREAD_OVEN_DEFINITION = {
  ...PROCESSING_BUILDING_CONSTRUCTION,
  materials: { reed: 4, clay: 6, bakingTools: 2 }
} as const;

export const FARM_BUILDING_DEFINITIONS = {
  breadOven: BREAD_OVEN_DEFINITION,
  mill: {
    footprint: { columns: 2, rows: 2 },
    constructionDurationMs: 2 * 60 * 1_000,
    barleyStorageBonus: 0,
    materials: { reed: 2, clay: 4 }
  },
  brewery: PROCESSING_BUILDING_CONSTRUCTION,
  granary: {
    footprint: { columns: 2, rows: 2 },
    constructionDurationMs: 2 * 60 * 1_000,
    barleyStorageBonus: 15,
    materials: {
      reed: 2,
      clay: 3
    }
  }
} as const satisfies Record<
  FarmBuildingType,
  {
    readonly footprint: {
      readonly columns: number;
      readonly rows: number;
    };
    readonly constructionDurationMs: number;
    readonly barleyStorageBonus: number;
    readonly materials: Partial<Record<InventoryItemKey, number>>;
  }
>;
