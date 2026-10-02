import { z } from "zod";

export const inventoryItemKeys = ["barley", "reed", "clay", "brewingVessels", "bakingTools", "emptyBeerJar", "water", "beer", "fish", "flour", "brewersGroats", "bread", "donkey"] as const;

export const InventoryItemKeySchema = z.enum(inventoryItemKeys);

export type InventoryItemKey = z.infer<typeof InventoryItemKeySchema>;
