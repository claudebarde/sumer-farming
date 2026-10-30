import { MarketPresenceResponseSchema, type MarketPresenceCommand } from "../../schemas/marketPresence";
import { developmentPlayerHeaders } from "./developmentPlayer";

export const sendMarketPresence = async (command: MarketPresenceCommand, signal?: AbortSignal) => {
  const response = await fetch("/api/market/presence", {
    method: "POST", headers: { ...developmentPlayerHeaders(), "content-type": "application/json" },
    body: JSON.stringify(command), signal, keepalive: command.type === "leave"
  });
  if (response.status === 409) return null;
  if (!response.ok) throw new Error("Market presence unavailable");
  return MarketPresenceResponseSchema.parse(await response.json()).visitors;
};
