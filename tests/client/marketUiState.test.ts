import { describe, expect, it } from "vitest";
import { marketUiStore } from "../../src/client/stores/marketUiStore";

describe("market UI state", () => {
  it("opens the leaderboard only in the market and closes it on exit or trade", () => {
    marketUiStore.getState().setLocation("farm");
    marketUiStore.getState().setLeaderboardOpen(true);
    expect(marketUiStore.getState().leaderboardOpen).toBe(false);
    marketUiStore.getState().setLocation("market");
    marketUiStore.getState().setLeaderboardOpen(true);
    expect(marketUiStore.getState().leaderboardOpen).toBe(true);
    marketUiStore.getState().openMarket("beer");
    expect(marketUiStore.getState().leaderboardOpen).toBe(false);
    marketUiStore.getState().setLeaderboardOpen(true);
    expect(marketUiStore.getState().isOpen).toBe(false);
    marketUiStore.getState().setLocation("farm");
    expect(marketUiStore.getState().leaderboardOpen).toBe(false);
  });
  it("closes trade dialogs on entering or leaving the market", () => {
    marketUiStore.getState().openMarket("barley");
    marketUiStore.getState().setLocation("market");
    expect(marketUiStore.getState().isOpen).toBe(false);
    marketUiStore.getState().openMarket("beer");
    marketUiStore.getState().setLocation("farm");
    expect(marketUiStore.getState().isOpen).toBe(false);
  });
});
