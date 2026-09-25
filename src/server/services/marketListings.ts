import { and, asc, eq, ne, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { MARKET_LISTINGS_PAGE_SIZE, type MarketListingsQuery, type MarketListingsPage } from "../../schemas/marketListings";
import type { Database } from "../db/client";
import { marketOrders } from "../db/schema";

export class MarketListingsError extends Data.TaggedError("MarketListingsError")<{
  readonly cause: unknown;
}> {}

export const getMarketListings = (
  database: Database,
  playerId: string,
  query: MarketListingsQuery
): Effect.Effect<MarketListingsPage, MarketListingsError> =>
  Effect.tryPromise({
    try: async () => {
      const after = query.after;
      const rows = await database.select({
        id: marketOrders.id,
        unitPrice: marketOrders.unitPrice,
        remainingQuantity: marketOrders.remainingQuantity,
        // Preserve PostgreSQL microseconds so equal-price cursors never skip rows.
        createdAt: sql<string>`to_char(${marketOrders.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`
      }).from(marketOrders).where(and(
        eq(marketOrders.itemKey, query.itemKey),
        eq(marketOrders.side, "sell"),
        eq(marketOrders.status, "open"),
        query.action === "sell"
          ? eq(marketOrders.playerId, playerId)
          : ne(marketOrders.playerId, playerId),
        after === undefined ? undefined : sql`(${marketOrders.unitPrice}, ${marketOrders.createdAt}, ${marketOrders.id}) > (${after.unitPrice}, ${after.createdAt}::timestamptz, ${after.id}::uuid)`
      )).orderBy(
        asc(marketOrders.unitPrice),
        asc(marketOrders.createdAt),
        asc(marketOrders.id)
      ).limit(MARKET_LISTINGS_PAGE_SIZE + 1);
      const page = rows.slice(0, MARKET_LISTINGS_PAGE_SIZE);
      const last = page.at(-1);
      return {
        orders: page.map(({ id, unitPrice, remainingQuantity }) => ({ id, unitPrice, remainingQuantity })),
        nextCursor: rows.length > MARKET_LISTINGS_PAGE_SIZE && last !== undefined
          ? { id: last.id, unitPrice: last.unitPrice, createdAt: last.createdAt }
          : null
      };
    },
    catch: cause => new MarketListingsError({ cause })
  });
