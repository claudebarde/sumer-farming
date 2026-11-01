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
    expect(canOpenMarketStand("beer", 5)).toBe(true);
    expect(canOpenMarketStand("beer", 6)).toBe(true);
    expect(canOpenMarketStand("bread", 5)).toBe(true);
    expect(canOpenMarketStand("bread", 6)).toBe(true);
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
  const items = ["barley", "beer", "bread", "brewingVessels", "emptyBeerJar"];

  it("offers empty jars only in the supplies stand's NPC Buy tab", () => {
    expect(marketIncludesItem("supplies", "emptyBeerJar", { market: "npc", action: "buy" })).toBe(true);
    expect(marketIncludesItem("supplies", "emptyBeerJar", { market: "npc", action: "sell" })).toBe(false);
    for (const action of ["buy", "sell"] as const) {
      expect(marketIncludesItem("supplies", "emptyBeerJar", { market: "player", action })).toBe(false);
    }
    expect(marketIncludesItem("barley", "emptyBeerJar", { market: "npc", action: "buy" })).toBe(false);
    expect(marketIncludesItem("supplies", "brewingVessels", { market: "npc", action: "buy" })).toBe(true);
    expect(marketIncludesItem("supplies", "brewingVessels", { market: "player", action: "buy" })).toBe(false);
  });

  it.each(["barley", "beer", "bread"] as const)("restricts %s market to its product", scope => {
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

  it("keeps brewing supplies separate from beer", () => {
    expect(items.filter(item => marketIncludesItem("supplies", item, { market: "npc", action: "buy" })))
      .toEqual(["brewingVessels", "emptyBeerJar"]);
  });

  it("does not restrict farm purchase shortcuts to the last visited stand", () => {
    marketUiStore.getState().openMarket("barley");
    marketUiStore.getState().setLocation("farm");
    expect(marketUiStore.getState().isOpen).toBe(false);
    marketUiStore.getState().openMarket("beer");
    expect(marketUiStore.getState().scope).toBe("beer");
  });
});

it("moves all equipment exclusively to supplies without changing food stands", () => {
  for (const item of ["emptyBeerJar", "bakingTools", "brewingVessels", "donkey"]) {
    expect(marketIncludesItem("supplies", item, { market: "npc", action: "buy" })).toBe(true);
    expect(marketIncludesItem("supplies", item, { market: "npc", action: "sell" })).toBe(false);
    for (const scope of ["beer", "bread", "produce", "barley"] as const)
      expect(marketIncludesItem(scope, item, { market: "npc", action: "buy" })).toBe(false);
  }
  expect(canOpenMarketStand("supplies", 4)).toBe(false);
  expect(canOpenMarketStand("supplies", 5)).toBe(false);
  expect(canOpenMarketStand("supplies", 6)).toBe(true);
});

it("offers oil at the produce stand from level ten", () => {
 expect(marketUnlockLevel("oil")).toBe(10);
 for (const action of ["buy", "sell"] as const)
   expect(marketIncludesItem("produce", "oil", {market: "npc", action})).toBe(true);
 expect(marketIncludesItem("beer", "oil")).toBe(false);
});
