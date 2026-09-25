import { and, eq, gte, sql } from "drizzle-orm";
import { Data, Effect } from "effect";

import {
  calculateSellOrderStatistics,
  calculateTradeAveragePrice,
  suggestSellUnitPrice,
  type SellOrderStatistics
} from "../../game-core/market/pricing";
import {
  MARKET_ITEM_DEFINITIONS,
  marketItemKeys,
  type MarketItemKey
} from "../../game-data/marketItems";
import type { MarketQuotes } from "../../schemas/market";
import type { Database } from "../db/client";
import { marketOrders, marketTrades } from "../db/schema";

type SellOrderQuoteRecord = {
  readonly id: string;
  readonly playerId: string;
  readonly itemKey: MarketItemKey;
  readonly unitPrice: number;
  readonly remainingQuantity: number;
};

export class MarketQuotesPersistenceError extends Data.TaggedError(
  "MarketQuotesPersistenceError"
)<{
  readonly cause: unknown;
}> {}

export const buildMarketQuotes = (
  orders: readonly SellOrderQuoteRecord[],
  _currentPlayerId: string,
  quotedAt: Date = new Date(),
  recentTrades: readonly { readonly itemKey: MarketItemKey; readonly quantity: number; readonly unitPrice: number }[] = [],
  aggregatedStatistics?: readonly (SellOrderStatistics & { readonly itemKey: MarketItemKey })[]
): MarketQuotes => ({
  quotedAt: quotedAt.toISOString(),
  items: marketItemKeys.map(itemKey => {
    const definition = MARKET_ITEM_DEFINITIONS[itemKey];
    const itemOrders = orders.filter(order => order.itemKey === itemKey);
    const statistics = aggregatedStatistics?.find(value => value.itemKey === itemKey)
      ?? calculateSellOrderStatistics(itemOrders);

    return {
      itemKey,
      label: definition.label,
      storageType: definition.storage.type,
      npcMarket: definition.npcMarket,
      playerMarket: {
        canCreateSellOrder: definition.playerMarket.canCreateSellOrder,
        lowestSellPrice: statistics.lowestSellPrice,
        weightedAverageSellPrice: statistics.weightedAverageSellPrice,
        totalSellQuantity: statistics.totalSellQuantity,
        highestBuyPrice: null,
        recentTradeAveragePrice: calculateTradeAveragePrice(recentTrades.filter(trade => trade.itemKey === itemKey)),
        suggestedSellPrice: suggestSellUnitPrice(
          statistics,
          definition.npcMarket.canBuy ? definition.npcMarket.buyPrice : definition.npcMarket.sellPrice
        )
      }
    };
  })
});

export const getMarketQuotes = (
  database: Database,
  currentPlayerId: string
): Effect.Effect<MarketQuotes, MarketQuotesPersistenceError> =>
  Effect.tryPromise({
    try: async () => {
      const statistics = await database
        .select({
          itemKey: marketOrders.itemKey,
          lowestSellPrice: sql<number>`min(${marketOrders.unitPrice})`.mapWith(Number),
          totalSellQuantity: sql<number>`sum(${marketOrders.remainingQuantity})`.mapWith(Number),
          weightedAverageSellPrice: sql<number>`sum(${marketOrders.unitPrice}::numeric * ${marketOrders.remainingQuantity}) / nullif(sum(${marketOrders.remainingQuantity}), 0)`.mapWith(Number)
        })
        .from(marketOrders)
        .where(
          and(
            eq(marketOrders.side, "sell"),
            eq(marketOrders.status, "open")
          )
        )
        .groupBy(marketOrders.itemKey);

      const now = new Date();
      const trades = await database.select({
        itemKey: marketTrades.itemKey,
        quantity: sql<number>`sum(${marketTrades.quantity})`.mapWith(Number),
        unitPrice: sql<number>`sum(${marketTrades.quantity}::numeric * ${marketTrades.unitPrice}) / sum(${marketTrades.quantity})`.mapWith(Number)
      }).from(marketTrades)
        .where(gte(marketTrades.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)))
        .groupBy(marketTrades.itemKey);
      return buildMarketQuotes([], currentPlayerId, now, trades, statistics);
    },
    catch: cause => new MarketQuotesPersistenceError({ cause })
  });
