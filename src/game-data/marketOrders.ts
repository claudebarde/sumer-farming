import { z } from "zod";

export const marketOrderSides = ["sell", "buy"] as const;
export const marketOrderStatuses = ["open", "filled", "cancelled"] as const;

export const MarketOrderSideSchema = z.enum(marketOrderSides);
export const MarketOrderStatusSchema = z.enum(marketOrderStatuses);

export type MarketOrderSide = z.infer<typeof MarketOrderSideSchema>;
export type MarketOrderStatus = z.infer<typeof MarketOrderStatusSchema>;
