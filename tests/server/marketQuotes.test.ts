import { describe, expect, it } from "vitest";

import { GameCommandSchema } from "../../src/schemas/gameCommands";
import { MarketQuotesSchema } from "../../src/schemas/market";
import { buildMarketQuotes } from "../../src/server/services/marketQuotes";

describe("market quotes", () => {
  it("weights completed trades by quantity independently of current asking prices", () => {
    const quotes = buildMarketQuotes([], "buyer", new Date(), [
      { itemKey: "barley", quantity: 1, unitPrice: 2 },
      { itemKey: "barley", quantity: 3, unitPrice: 4 }
    ]);
    expect(quotes.items[0]?.playerMarket.recentTradeAveragePrice).toBe(3.5);
    expect(quotes.items[0]?.playerMarket.weightedAverageSellPrice).toBeNull();
  });
  it("creates a validated quote from the tradable item catalog", () => {
    const quotedAt = new Date("2026-09-11T12:00:00.000Z");
    const currentPlayerId = "d6eb9b1b-438e-4f5f-874d-6cc27dfab48e";
    const otherPlayerId = "88286a4c-6a5f-4ecb-8cfc-96e6e894fa93";
    const quote = MarketQuotesSchema.parse(
      buildMarketQuotes(
        [
          {
            id: "554399e9-7c5d-4602-9d23-22a428610d7d",
            playerId: currentPlayerId,
            itemKey: "barley",
            unitPrice: 2,
            remainingQuantity: 1
          },
          {
            id: "8b596158-95bb-445a-9c59-d1b1874c55f0",
            playerId: otherPlayerId,
            itemKey: "barley",
            unitPrice: 4,
            remainingQuantity: 3
          }
        ],
        currentPlayerId,
        quotedAt
      )
    );

    expect({ ...quote, items: quote.items.filter(item => item.itemKey === "barley") }).toEqual({
      quotedAt: quotedAt.toISOString(),
      items: [
        {
          itemKey: "barley",
          label: "Barley",
          storageType: "barley_storage",
          npcMarket: {
            canBuy: true,
            canSell: true,
            buyPrice: 2,
            sellPrice: 1
          },
          playerMarket: {
            canCreateSellOrder: true,
            lowestSellPrice: 2,
            highestBuyPrice: null,
            weightedAverageSellPrice: 3.5,
            recentTradeAveragePrice: null,
            totalSellQuantity: 4,
            suggestedSellPrice: 4
          }
        }
      ]
    });
  });

  it("accepts catalog items and rejects non-tradable inventory items", () => {
    const baseCommand = {
      type: "buy_from_npc_market",
      quantity: 1,
      expectedUnitPrice: 2,
      idempotencyKey: "d6eb9b1b-438e-4f5f-874d-6cc27dfab48e",
      expectedFarmVersion: 1
    } as const;

    expect(
      GameCommandSchema.safeParse({ ...baseCommand, itemKey: "barley" })
        .success
    ).toBe(true);
    expect(
      GameCommandSchema.safeParse({ ...baseCommand, itemKey: "reed" }).success
    ).toBe(false);
  });
});
