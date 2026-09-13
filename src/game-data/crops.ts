import { z } from "zod";

import type { InventoryItemKey } from "./inventoryItems";

export const cropKeys = ["barley"] as const;

export const CropKeySchema = z.enum(cropKeys);

export type CropKey = z.infer<typeof CropKeySchema>;

export const CROP_DEFINITIONS = {
  barley: {
    seedItemKey: "barley",
    harvestItemKey: "barley",
    sowingDurationMs: 10_000,
    growthDurationMs: 5 * 60_000,
    harvestDurationMs: 10_000,
    harvestYield: 2
  }
} as const satisfies Record<
  CropKey,
  {
    readonly seedItemKey: InventoryItemKey;
    readonly harvestItemKey: InventoryItemKey;
    readonly sowingDurationMs: number;
    readonly growthDurationMs: number;
    readonly harvestDurationMs: number;
    readonly harvestYield: number;
  }
>;
