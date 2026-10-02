import { createStore } from "zustand/vanilla";

export type MarketScope = "barley" | "beer" | "bread";
export const MARKET_TITLES: Record<MarketScope, string> = {
  barley: "Barley market", beer: "Beer market", bread: "Baking market"
};
export const marketIncludesItem = (
  scope: MarketScope,
  itemKey: string,
  trade?: { readonly market: "npc" | "player"; readonly action: "buy" | "sell" }
): boolean =>
  scope === itemKey ||
  (scope === "bread" && itemKey === "flour") ||
  (scope === "beer" && itemKey === "brewersGroats") ||
  (scope === "bread" && (itemKey === "bakingTools" || itemKey === "donkey") && trade?.market === "npc" && trade.action === "buy") ||
  (scope === "beer" && (itemKey === "emptyBeerJar" || itemKey === "brewingVessels") &&
    trade?.market === "npc" && trade.action === "buy");

type State = {
  readonly location: "farm" | "market";
  readonly setLocation: (location: "farm" | "market") => void;
  readonly isOpen: boolean;
  readonly scope: MarketScope;
  readonly openMarket: (scope: MarketScope) => void;
  readonly setOpen: (isOpen: boolean) => void;
};

export const marketUiStore = createStore<State>()(set => ({
  location: "farm",
  setLocation: location => set({ location, isOpen: false }),
  isOpen: false,
  scope: "barley",

  openMarket: scope => {
    set({ isOpen: true, scope });
  },

  setOpen: isOpen => {
    set({ isOpen });
  }
}));
