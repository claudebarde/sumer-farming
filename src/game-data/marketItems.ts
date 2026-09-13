import { z } from "zod";

import type { InventoryItemKey } from "./inventoryItems";

export const marketItemKeys = [
  "barley"
] as const satisfies readonly InventoryItemKey[];

export const MarketItemKeySchema = z.enum(marketItemKeys);

export type MarketItemKey = z.infer<typeof MarketItemKeySchema>;

export const MARKET_ITEM_DEFINITIONS = {
  barley: {
    label: "Barley",
    storage: { type: "barley_storage" },
    npcMarket: {
      canBuy: true,
      canSell: true,
      buyPrice: 2,
      sellPrice: 1
    }
  }
} as const satisfies Record<
  MarketItemKey,
  {
    readonly label: string;
    readonly storage: { readonly type: "barley_storage" };
    readonly npcMarket: {
      readonly canBuy: boolean;
      readonly canSell: boolean;
      readonly buyPrice: number;
      readonly sellPrice: number;
    };
  }
>;
