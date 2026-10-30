import { MARKET_PRESENCE_POLL_MS, MARKET_PRESENCE_TTL_MS, type MarketPosition, type MarketVisitor } from "../../schemas/marketPresence";
import { sendMarketPresence } from "../api/marketPresence";

/** One bounded request at a time. A new visit ID isolates late replies after leaving. */
export const createMarketPresenceSession = (options: {
  eligible: () => boolean;
  position: () => MarketPosition;
  receive: (visitors: readonly MarketVisitor[]) => void;
  send?: typeof sendMarketPresence;
}) => {
  const send = options.send ?? sendMarketPresence;
  let active: { id: string; joined: boolean; controller?: AbortController; lastSuccess: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (!active && timer === undefined) return;
    const old = active; active = null;
    clearTimeout(timer); timer = undefined;
    old?.controller?.abort();
    options.receive([]);
    if (old) void send({ type: "leave", sessionId: old.id }).catch(() => {});
  };
  const poll = async () => {
    const visit = active;
    if (!visit) return;
    if (!options.eligible()) { stop(); return; }
    const controller = new AbortController(); visit.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const visitors = await send({ type: visit.joined ? "heartbeat" : "join", sessionId: visit.id,
        position: options.position() }, controller.signal);
      if (active !== visit) return;
      if (visitors === null) {
        // Closed/expired session: fresh ID on the next poll; never reuse a tombstone.
        stop();
        if (options.eligible()) timer = setTimeout(() => { timer = undefined; start(); }, 2000);
        return;
      }
      visit.joined = true; visit.lastSuccess = Date.now(); options.receive(visitors);
    } catch {
      if (active === visit && Date.now() - visit.lastSuccess >= MARKET_PRESENCE_TTL_MS) options.receive([]);
    } finally {
      clearTimeout(timeout);
      if (active === visit) timer = setTimeout(() => { timer = undefined; void poll(); }, MARKET_PRESENCE_POLL_MS);
    }
  };
  const start = () => {
    if (active || timer !== undefined || !options.eligible()) return;
    active = { id: crypto.randomUUID(), joined: false, lastSuccess: Date.now() };
    void poll();
  };
  return { start, stop };
};
