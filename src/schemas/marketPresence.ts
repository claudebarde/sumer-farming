import { z } from "zod";

export const MARKET_PRESENCE_TTL_MS = 15_000;
export const MARKET_PRESENCE_POLL_MS = 500;
// Coordinates relative to the market square's left edge. The approach road is
// normalized to three tiles so phone and desktop visitors share one space.
export const MarketPositionSchema = z.object({
  column: z.number().int().min(-3).max(4), row: z.number().int().min(3).max(7)
}).refine(({ column, row }) => column < 0 ? row === 5
  : column === 0 || column === 4 || row === 3 || row === 7, "Stay on a market road");
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
