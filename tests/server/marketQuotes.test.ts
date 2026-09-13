import { describe, expect, it } from "vitest";

import { GameCommandSchema } from "../../src/schemas/gameCommands";
import { MarketQuotesSchema } from "../../src/schemas/market";
import { getMarketQuotes } from "../../src/server/services/marketQuotes";

describe("market quotes", () => {
  it("creates a validated quote from the tradable item catalog", () => {
    const quotedAt = new Date("2026-09-11T12:00:00.000Z");
    const quote = MarketQuotesSchema.parse(getMarketQuotes(quotedAt));

    expect(quote).toEqual({
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
            lowestSellPrice: null,
            highestBuyPrice: null
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
