import { z } from "zod";
import { MarketItemKeySchema } from "../game-data/marketItems";

export const MARKET_LISTINGS_PAGE_SIZE = 5;
export const MarketListingCursorSchema = z.object({
  unitPrice: z.int().positive(),
  createdAt: z.iso.datetime(),
  id: z.uuid()
});
export const MarketListingsQuerySchema = z.object({
  itemKey: MarketItemKeySchema,
  action: z.enum(["buy", "sell"]),
  after: MarketListingCursorSchema.optional()
});
export const MarketListingsPageSchema = z.object({
  orders: z.array(z.object({
    id: z.uuid(),
    unitPrice: z.int().positive(),
    remainingQuantity: z.int().positive()
  })).max(MARKET_LISTINGS_PAGE_SIZE),
  nextCursor: MarketListingCursorSchema.nullable()
});
export type MarketListingCursor = z.infer<typeof MarketListingCursorSchema>;
export type MarketListingsQuery = z.infer<typeof MarketListingsQuerySchema>;
export type MarketListingsPage = z.infer<typeof MarketListingsPageSchema>;
