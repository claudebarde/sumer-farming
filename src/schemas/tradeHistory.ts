import { z } from "zod";
import { InventoryItemKeySchema } from "../game-data/inventoryItems";
import { ShekelTransactionTypeSchema } from "../game-data/shekelTransactions";

export const TradeHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.uuid().optional(),
  transactionKey: z.uuid().optional()
});

export const TradeHistorySchema = z.object({
  trades: z.array(z.object({
    id: z.uuid(),
    type: ShekelTransactionTypeSchema,
    source: z.enum(["npc", "player"]),
    itemKey: InventoryItemKeySchema,
    quantity: z.int().positive(),
    unitPrice: z.int().positive(),
    total: z.int().positive(),
    createdAt: z.iso.datetime()
  })),
  nextCursor: z.uuid().nullable()
});

export type TradeHistory = z.infer<typeof TradeHistorySchema>;
export type TradeHistoryQuery = z.infer<typeof TradeHistoryQuerySchema>;
