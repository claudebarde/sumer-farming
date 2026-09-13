import { z } from "zod";

import { MarketItemKeySchema } from "../game-data/marketItems";

const UnitPriceSchema = z.int().positive();

export const MarketQuotesSchema = z.object({
  quotedAt: z.iso.datetime(),
  items: z.array(
    z.object({
      itemKey: MarketItemKeySchema,
      label: z.string().min(1),
      storageType: z.literal("barley_storage"),
      npcMarket: z.object({
        canBuy: z.boolean(),
        canSell: z.boolean(),
        buyPrice: UnitPriceSchema,
        sellPrice: UnitPriceSchema
      }),
      playerMarket: z.object({
        lowestSellPrice: UnitPriceSchema.nullable(),
        highestBuyPrice: UnitPriceSchema.nullable()
      })
    })
  )
});

export type MarketQuotes = z.infer<typeof MarketQuotesSchema>;
