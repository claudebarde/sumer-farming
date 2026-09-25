import { z } from "zod";

export const inventoryItemKeys = ["barley", "reed", "clay", "brewingVessels", "emptyBeerJar", "water", "beer", "fish"] as const;

export const InventoryItemKeySchema = z.enum(inventoryItemKeys);

export type InventoryItemKey = z.infer<typeof InventoryItemKeySchema>;
