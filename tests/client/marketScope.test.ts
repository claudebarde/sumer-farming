import { afterEach, describe, expect, it } from "vitest";
import { marketIncludesItem, marketUiStore } from "../../src/client/stores/marketUiStore";
import { canEnterMarket, canOpenMarketStand, marketUnlockLevel } from "../../src/game-data/progression";

afterEach(() => marketUiStore.getState().setLocation("farm"));

describe("market entry progression", () => {
  it.each([1, 2, 3, 4])("blocks the beer stand dialog at level %i", level => {
    expect(canOpenMarketStand("beer", level)).toBe(false);
  });

  it("opens barley at level 3 and brewing supplies at level 6", () => {
    expect(canOpenMarketStand("barley", 2)).toBe(false);
    expect(canOpenMarketStand("barley", 3)).toBe(true);
    expect(canOpenMarketStand("beer", 5)).toBe(false);
    expect(canOpenMarketStand("beer", 6)).toBe(true);
    expect(canOpenMarketStand("beer")).toBe(false);
  });
  it.each([undefined, 1, 2])("blocks entry at level %s", level => {
    expect(canEnterMarket(level)).toBe(false);
  });

  it.each([3, 4, 5, 6, 7, 8, 9, 10])("allows entry at level %s", level => {
    expect(canEnterMarket(level)).toBe(true);
  });

  it("unlocks entry at the same level as barley trading", () => {
    expect(canEnterMarket(marketUnlockLevel("barley") - 1)).toBe(false);
    expect(canEnterMarket(marketUnlockLevel("barley"))).toBe(true);
  });
});

describe("stand-specific markets", () => {
  const items = ["barley", "beer", "brewingVessels", "emptyBeerJar"];

  it("offers empty jars only in the beer stand's NPC Buy tab", () => {
    expect(marketIncludesItem("beer", "emptyBeerJar", { market: "npc", action: "buy" })).toBe(true);
    expect(marketIncludesItem("beer", "emptyBeerJar", { market: "npc", action: "sell" })).toBe(false);
    for (const action of ["buy", "sell"] as const) {
      expect(marketIncludesItem("beer", "emptyBeerJar", { market: "player", action })).toBe(false);
    }
    expect(marketIncludesItem("barley", "emptyBeerJar", { market: "npc", action: "buy" })).toBe(false);
    expect(marketIncludesItem("beer", "brewingVessels", { market: "npc", action: "buy" })).toBe(true);
    expect(marketIncludesItem("beer", "brewingVessels", { market: "player", action: "buy" })).toBe(false);
  });

  it.each(["barley", "beer"] as const)("restricts %s market to its product", scope => {
    marketUiStore.getState().openMarket(scope);
    expect(marketUiStore.getState().isOpen).toBe(true);
    expect(marketUiStore.getState().scope).toBe(scope);
    expect(items.filter(item => marketIncludesItem(scope, item))).toEqual([scope]);
  });

  it("switches between stands without retaining the previous product", () => {
    marketUiStore.getState().openMarket("barley");
    marketUiStore.getState().setOpen(false);
    marketUiStore.getState().openMarket("beer");
    expect(marketUiStore.getState().scope).toBe("beer");
  });

  it("keeps brewing supplies accessible in the beer NPC market", () => {
    expect(items.filter(item => marketIncludesItem("beer", item, { market: "npc", action: "buy" })))
      .toEqual(["beer", "brewingVessels", "emptyBeerJar"]);
  });

  it("does not restrict farm purchase shortcuts to the last visited stand", () => {
    marketUiStore.getState().openMarket("barley");
    marketUiStore.getState().setLocation("farm");
    expect(marketUiStore.getState().isOpen).toBe(false);
    marketUiStore.getState().openMarket("beer");
    expect(marketUiStore.getState().scope).toBe("beer");
  });
});
