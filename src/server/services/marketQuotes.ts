import {
  MARKET_ITEM_DEFINITIONS,
  marketItemKeys
} from "../../game-data/marketItems";
import type { MarketQuotes } from "../../schemas/market";

export const getMarketQuotes = (quotedAt: Date = new Date()): MarketQuotes => ({
  quotedAt: quotedAt.toISOString(),
  items: marketItemKeys.map(itemKey => {
    const definition = MARKET_ITEM_DEFINITIONS[itemKey];

    return {
      itemKey,
      label: definition.label,
      storageType: definition.storage.type,
      npcMarket: definition.npcMarket,
      playerMarket: {
        lowestSellPrice: null,
        highestBuyPrice: null
      }
    };
  })
});
