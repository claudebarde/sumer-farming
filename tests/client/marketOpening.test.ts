import { afterEach, expect, it, vi } from "vitest";
import { marketUiStore, subscribeMarketOpening } from "../../src/client/stores/marketUiStore";

afterEach(() => marketUiStore.getState().setLocation("farm"));
it("resets on reopening a stand, changing stands and externally reopening, not ordinary updates", () => {
  marketUiStore.getState().setOpen(false);
  const reset = vi.fn();
  const unsubscribe = subscribeMarketOpening(reset);
  try {
    marketUiStore.getState().openMarket("bread");
    expect(reset).toHaveBeenCalledTimes(1);
    marketUiStore.getState().setOpen(true);
    expect(reset).toHaveBeenCalledTimes(1);
    marketUiStore.getState().setOpen(false);
    marketUiStore.getState().openMarket("bread");
    expect(reset).toHaveBeenCalledTimes(2);
    marketUiStore.getState().openMarket("beer");
    expect(reset).toHaveBeenCalledTimes(3);
    marketUiStore.getState().setLocation("farm");
    marketUiStore.getState().openMarket("barley");
    expect(reset).toHaveBeenCalledTimes(4);
  } finally { unsubscribe(); }
  marketUiStore.getState().setOpen(false);
  marketUiStore.getState().setOpen(true);
  expect(reset).toHaveBeenCalledTimes(4);
});
