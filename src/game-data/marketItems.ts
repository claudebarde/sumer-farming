import { z } from "zod";

import type { InventoryItemKey } from "./inventoryItems";

export const marketItemKeys = [
  "barley", "brewingVessels", "emptyBeerJar", "beer"
] as const satisfies readonly InventoryItemKey[];

export const MarketItemKeySchema = z.enum(marketItemKeys);

export type MarketItemKey = z.infer<typeof MarketItemKeySchema>;

export const MARKET_ITEM_DEFINITIONS = {
  beer: {
    label: "Beer jar",
    storage: { type: "estate_inventory" },
    npcMarket: { canBuy: false, canSell: true, buyPrice: 5, sellPrice: 5 },
    playerMarket: { canCreateSellOrder: true }
  },
  emptyBeerJar: {
    label: "Empty beer jar",
    storage: { type: "estate_inventory" },
    npcMarket: { canBuy: true, canSell: false, buyPrice: 2, sellPrice: 1 },
    playerMarket: { canCreateSellOrder: false }
  },
  brewingVessels: {
    // Keep the persisted item key stable for existing inventories and trade records.
    label: "Brewing jar",
    storage: { type: "estate_inventory" },
    npcMarket: { canBuy: true, canSell: false, buyPrice: 6, sellPrice: 1 },
    playerMarket: { canCreateSellOrder: false }
  },
  barley: {
    label: "Barley",
    storage: { type: "barley_storage" },
    npcMarket: {
      canBuy: true,
      canSell: true,
      buyPrice: 2,
      sellPrice: 1
    },
    playerMarket: {
      canCreateSellOrder: true
    }
  }
} as const satisfies Record<
  MarketItemKey,
  {
    readonly label: string;
    readonly storage: { readonly type: "barley_storage" | "estate_inventory" };
    readonly npcMarket: {
      readonly canBuy: boolean;
      readonly canSell: boolean;
      readonly buyPrice: number;
      readonly sellPrice: number;
    };
    readonly playerMarket: {
      readonly canCreateSellOrder: boolean;
    };
  }
>;
