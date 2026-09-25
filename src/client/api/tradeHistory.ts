import { TradeHistoryQuerySchema, TradeHistorySchema, type TradeHistoryQuery } from "../../schemas/tradeHistory";
import { developmentPlayerHeaders } from "./developmentPlayer";

export const fetchTradeHistory = async (query: TradeHistoryQuery, signal?: AbortSignal) => {
  const parsed = TradeHistoryQuerySchema.parse(query);
  const params = new URLSearchParams({ limit: String(parsed.limit) });
  if (parsed.before !== undefined) params.set("before", parsed.before);
  if (parsed.transactionKey !== undefined) params.set("transactionKey", parsed.transactionKey);
  const response = await fetch(`/api/market/history?${params}`, {
    headers: developmentPlayerHeaders(), signal
  });
  if (!response.ok) throw new Error("Your trade history could not be loaded");
  return TradeHistorySchema.parse(await response.json());
};
