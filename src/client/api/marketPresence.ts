import { MARKET_PRESENCE_POLL_MS, MarketPresenceResponseSchema, type MarketPosition, type MarketPresenceCommand, type MarketVisitor } from "../../schemas/marketPresence";
import { developmentPlayerHeaders } from "./developmentPlayer";

export const requestMarketPresence = async (command: MarketPresenceCommand) => {
  const response = await fetch("/api/market/presence", {
    method: "POST", headers: { ...developmentPlayerHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(command), keepalive: command.type === "leave", signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) throw new Error("Live neighbours are temporarily unavailable.");
  return MarketPresenceResponseSchema.parse(await response.json()).visitors;
};

/** One request at a time. Session identity fences late responses and tab exits. */
export const startMarketPresence = (
  position: () => MarketPosition,
  receive: (visitors: readonly MarketVisitor[], available: boolean) => void,
  request = requestMarketPresence
) => {
  let stopped = false;
  let sessionId = crypto.randomUUID();
  let joined = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Set<string>();
  const poll = async () => {
    if (stopped || document.hidden || pending.has(sessionId)) return;
    clearTimeout(timer);
    const current = sessionId;
    pending.add(current);
    try {
      const visitors = await request({ type: joined ? "heartbeat" : "join", sessionId: current, position: position() });
      if (stopped || current !== sessionId) return;
      joined = true;
      receive(visitors, true);
    } catch {
      if (stopped || current !== sessionId) return;
      receive([], false);
    } finally {
      pending.delete(current);
    }
    if (!stopped && current === sessionId) timer = setTimeout(() => void poll(), MARKET_PRESENCE_POLL_MS);
  };
  const leave = () => {
    clearTimeout(timer);
    void request({ type: "leave", sessionId }).catch(() => { /* Server TTL handles disconnected exits. */ });
    sessionId = crypto.randomUUID();
    joined = false;
  };
  const visibility = () => {
    leave();
    receive([], true);
    if (!document.hidden) void poll();
  };
  const pagehide = () => leave();
  const pageshow = () => { if (!document.hidden) { clearTimeout(timer); void poll(); } };
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", pagehide);
  window.addEventListener("pageshow", pageshow);
  void poll();
  return () => {
    stopped = true;
    leave();
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("pagehide", pagehide);
    window.removeEventListener("pageshow", pageshow);
  };
};
