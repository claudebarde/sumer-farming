import {
  MarketQuotesSchema,
  type MarketQuotes
} from "../../schemas/market";

export const fetchMarketQuotes = async (
  signal?: AbortSignal
): Promise<MarketQuotes> => {
  const response = await fetch("/api/market/quotes", { signal });

  if (!response.ok) {
    throw new Error("The current market prices could not be loaded");
  }

  return MarketQuotesSchema.parse(await response.json());
};
