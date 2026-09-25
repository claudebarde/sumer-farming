import { and, desc, eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import type { TradeHistory, TradeHistoryQuery } from "../../schemas/tradeHistory";
import type { Database } from "../db/client";
import { shekelTransactions } from "../db/schema";

export class TradeHistoryPersistenceError extends Data.TaggedError("TradeHistoryPersistenceError")<{
  readonly cause: unknown;
}> {}

export const getTradeHistory = (
  database: Database,
  playerId: string,
  query: TradeHistoryQuery
): Effect.Effect<TradeHistory, TradeHistoryPersistenceError> =>
  Effect.tryPromise({
    try: async () => {
      const entries = await database.select().from(shekelTransactions)
        .where(and(
          eq(shekelTransactions.playerId, playerId),
          query.transactionKey === undefined ? undefined : eq(shekelTransactions.idempotencyKey, query.transactionKey),
          query.before === undefined ? undefined : sql`
            (${shekelTransactions.createdAt}, ${shekelTransactions.id}) < (
              SELECT cursor_entry.created_at, cursor_entry.id
              FROM shekel_transactions AS cursor_entry
              WHERE cursor_entry.id = ${query.before}::uuid
                AND cursor_entry.player_id = ${playerId}::uuid
            )`
        ))
        .orderBy(desc(shekelTransactions.createdAt), desc(shekelTransactions.id))
        .limit(query.limit + 1);
      const page = entries.slice(0, query.limit);
      return {
        trades: page.map(entry => ({
          id: entry.id,
          type: entry.type,
          requestCustomer: entry.requestCustomer,
          source: entry.source,
          itemKey: entry.itemKey,
          quantity: entry.itemQuantity,
          unitPrice: entry.unitPrice,
          total: Math.abs(entry.delta),
          createdAt: entry.createdAt.toISOString()
        })),
        nextCursor: entries.length > query.limit ? page.at(-1)!.id : null
      };
    },
    catch: cause => new TradeHistoryPersistenceError({ cause })
  });
