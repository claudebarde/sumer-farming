import { z } from "zod";

import type { InventoryItemKey } from "./inventoryItems";

export const cropKeys = ["barley", "datePalm", "sesame"] as const;

export const CropKeySchema = z.enum(cropKeys);

export type CropKey = z.infer<typeof CropKeySchema>;

export const CROP_DEFINITIONS = {
  barley: {
    kind: "annual",
    label: "Barley",
    unlockLevel: 1,
    sprites: { young: "barleySeeded", growing: "barleyGrowing", ready: "barleyReady" },
    seedItemKey: "barley",
    harvestItemKey: "barley",
    sowingDurationMs: 10_000,
    growthDurationMs: 30 * 60_000,
    harvestDurationMs: 10_000,
    harvestYield: 2
  },
  sesame: {
    kind: "annual", label: "Sesame", unlockLevel: 10,
    sprites: { young: "sesameYoung", growing: "sesameGrowing", ready: "sesameRipe" },
    seedItemKey: "sesame", harvestItemKey: "sesame",
    sowingDurationMs: 10_000, growthDurationMs: 60 * 60_000,
    harvestDurationMs: 10_000, harvestYield: 3
  },
  datePalm: {
    kind: "perennial", label: "Date palm", unlockLevel: 9,
    sprites: { young: "datePalmSapling", growing: "datePalmGrowing", ready: "datePalmReady" },
    seedItemKey: null, saplingCost: 25, maximumPlants: 2,
    harvestItemKey: "dates", sowingDurationMs: 10_000,
    growthDurationMs: 24 * 60 * 60_000,
    ripeningDurationMs: 24 * 60 * 60_000,
    harvestDurationMs: 10_000, harvestYield: 2
  }
} as const satisfies Record<
  CropKey,
  {
    readonly kind: "annual" | "perennial";
    readonly label: string;
    readonly unlockLevel: number;
    readonly sprites: { readonly young: string; readonly growing: string; readonly ready: string };
    readonly seedItemKey: InventoryItemKey | null;
    readonly saplingCost?: number;
    readonly maximumPlants?: number;
    readonly ripeningDurationMs?: number;
    readonly harvestItemKey: InventoryItemKey;
    readonly sowingDurationMs: number;
    readonly growthDurationMs: number;
    readonly harvestDurationMs: number;
    readonly harvestYield: number;
  }
>;

export type PerennialCropKey = { [Key in CropKey]: typeof CROP_DEFINITIONS[Key]["kind"] extends "perennial" ? Key : never }[CropKey];
export const perennialCropKeys = cropKeys.filter((key): key is PerennialCropKey => CROP_DEFINITIONS[key].kind === "perennial");
export const PerennialCropKeySchema = z.enum(perennialCropKeys);
