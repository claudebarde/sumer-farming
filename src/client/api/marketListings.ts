import { MarketListingsPageSchema, MarketListingsQuerySchema, type MarketListingsQuery } from "../../schemas/marketListings";
import { developmentPlayerHeaders } from "./developmentPlayer";

export const fetchMarketListings = async (query: MarketListingsQuery, signal?: AbortSignal) => {
  const parsed = MarketListingsQuerySchema.parse(query);
  const params = new URLSearchParams({ itemKey: parsed.itemKey, action: parsed.action });
  if (parsed.after !== undefined) params.set("after", JSON.stringify(parsed.after));
  const response = await fetch(`/api/market/listings?${params}`, {
    signal, headers: developmentPlayerHeaders()
  });
  if (!response.ok) throw new Error("Market listings could not be loaded");
  return MarketListingsPageSchema.parse(await response.json());
};
