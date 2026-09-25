import { z } from "zod";

import type { InventoryItemKey } from "./inventoryItems";

export const farmBuildingTypes = ["granary", "brewery"] as const;

export const FarmBuildingTypeSchema = z.enum(farmBuildingTypes);

export type FarmBuildingType = z.infer<typeof FarmBuildingTypeSchema>;

export const FARM_BUILDING_DEFINITIONS = {
  brewery: {
    footprint: { columns: 2, rows: 2 },
    constructionDurationMs: 3 * 60 * 1_000,
    barleyStorageBonus: 0,
    materials: { reed: 4, clay: 6, brewingVessels: 2 }
  },
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
