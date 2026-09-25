import { describe, expect, it, vi } from "vitest";
import type { TradeHistory } from "../../src/schemas/tradeHistory";
import { collectNewTrades } from "../../src/client/features/market/tradeNotifications";
import { createNotificationStore } from "../../src/client/stores/notificationStore";

const trade = (id: string): TradeHistory["trades"][number] => ({
  id, type: "market_sale", source: "player", itemKey: "barley",
  quantity: 2, unitPrice: 3, total: 6, createdAt: "2026-09-21T10:00:00.000Z"
});
const page = (ids: readonly string[], nextCursor: string | null = null): TradeHistory => ({
  trades: ids.map(trade), nextCursor
});

describe("trade notification delivery", () => {
  it("silently establishes a baseline without replaying old trades", async () => {
    const fetchPage = vi.fn().mockResolvedValue(page(["old"], "older"));
    expect(await collectNewTrades(fetchPage, undefined)).toEqual({ newestId: "old", trades: [] });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("detects the first trade for a player with no previous trades", async () => {
    expect(await collectNewTrades(async () => page(["new"]), null))
      .toEqual({ newestId: "new", trades: [trade("new")] });
  });

  it("collects all new pages in chronological order without replaying the boundary", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(page(["third", "second"], "second"))
      .mockResolvedValueOnce(page(["first", "baseline", "older"], "older"));
    const result = await collectNewTrades(fetchPage, "baseline");
    expect(result.trades.map(value => value.id)).toEqual(["first", "second", "third"]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenLastCalledWith("second");
  });

  it("propagates failed pages so the caller preserves its previous position", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(page(["new"], "new"))
      .mockRejectedValueOnce(new Error("offline"));
    await expect(collectNewTrades(fetchPage, "baseline")).rejects.toThrow("offline");
  });

  it("deduplicates immediate receipts, polling, and retries even after dismissal", () => {
    const store = createNotificationStore();
    store.getState().setPlayer("player-one");
    store.getState().notifyTrade("player-one", trade("receipt"));
    store.getState().notifyTrade("player-one", trade("receipt"));
    expect(store.getState().pending).toHaveLength(1);
    store.getState().dismiss("receipt");
    store.getState().notifyTrade("player-one", trade("receipt"));
    expect(store.getState().pending).toHaveLength(0);
  });

  it("clears the queue on player switching and ignores the previous player's late response", () => {
    const store = createNotificationStore();
    store.getState().setPlayer("one");
    store.getState().notifyTrade("one", trade("old"));
    store.getState().setPlayer("two");
    store.getState().notifyTrade("one", trade("late"));
    expect(store.getState().pending).toHaveLength(0);
    store.getState().notifyTrade("two", trade("new"));
    expect(store.getState().pending.map(value => value.id)).toEqual(["new"]);
  });
});
