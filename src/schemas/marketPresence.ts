import { isMarketRoad } from "../game-data/marketLayout";
import { z } from "zod";

export const MARKET_PRESENCE_TTL_MS = 15_000;
export const MARKET_PRESENCE_POLL_MS = 500;
export const MARKET_PRESENCE_UNLOCK_LEVEL = 10;
// Absolute isometric road coordinates, including positions between tile centres.
export const MarketPositionSchema = z.object({
  column: z.number().min(-4).max(11), row: z.number().min(5).max(11)
}).refine(isMarketRoad, "Stay on a market road");
export type MarketPosition = z.infer<typeof MarketPositionSchema>;
const visit = { sessionId: z.uuid() };
export const MarketPresenceCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join"), ...visit, position: MarketPositionSchema }),
  z.object({ type: z.literal("heartbeat"), ...visit, position: MarketPositionSchema }),
  z.object({ type: z.literal("leave"), ...visit })
]);
export type MarketPresenceCommand = z.infer<typeof MarketPresenceCommandSchema>;
export const MarketVisitorSchema = z.object({
  playerId: z.uuid(), name: z.string().max(50), position: MarketPositionSchema
});
export type MarketVisitor = z.infer<typeof MarketVisitorSchema>;
export const MarketPresenceResponseSchema = z.object({ visitors: z.array(MarketVisitorSchema).max(9) });
