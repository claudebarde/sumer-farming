import { z } from "zod";

import { MarketItemKeySchema } from "../game-data/marketItems";

const UnitPriceSchema = z.int().positive();

export const MarketQuotesSchema = z.object({
  quotedAt: z.iso.datetime(),
  items: z.array(
    z.object({
      itemKey: MarketItemKeySchema,
      label: z.string().min(1),
      storageType: z.enum(["barley_storage", "estate_inventory"]),
      npcMarket: z.object({
        canBuy: z.boolean(),
        canSell: z.boolean(),
        buyPrice: UnitPriceSchema,
        sellPrice: UnitPriceSchema
      }),
      playerMarket: z.object({
        canCreateSellOrder: z.boolean(),
        lowestSellPrice: UnitPriceSchema.nullable(),
        highestBuyPrice: UnitPriceSchema.nullable(),
        weightedAverageSellPrice: z.number().positive().nullable(),
        recentTradeAveragePrice: z.number().positive().nullable(),
        totalSellQuantity: z.int().nonnegative(),
        suggestedSellPrice: UnitPriceSchema
      })
    })
  )
});

export type MarketQuotes = z.infer<typeof MarketQuotesSchema>;
